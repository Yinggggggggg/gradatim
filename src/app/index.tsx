import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryPicker } from '@/components/category';
import { EntryCard } from '@/components/entry-card';
import { GrailHero } from '@/components/grail-hero';
import type { GrailDrop } from '@/components/grail-hero-types';
import { PlusIcon } from '@/components/icons';
import { ImageViewer } from '@/components/images';
import { InfoButton } from '@/components/info-button';
import { PressableScale } from '@/components/pressable-scale';
import { type RecordDraft, RecordSheet } from '@/components/record-sheet';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, TextButton, WEB_TAB_BAR_SPACE } from '@/components/ui';
import { Fonts, Hero, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { attachmentUri, deleteEntryAndAttachments, saveAttachments } from '@/lib/attachments';
import { guessCategory } from '@/lib/categories';
import { daysBetween, formatDayLabel, formatTime, parseDay, toDayString, todayString } from '@/lib/dates';
import {
  type Attachment,
  countGrowthDays,
  type Entry,
  getLastEntryBefore,
  insertEntry,
  listAttachmentsFor,
  listRecentEntries,
  setEntryCategory,
} from '@/lib/db';
import { CUP_DAYS, grailProgress } from '@/lib/grail';
import { setCelebratedDays } from '@/lib/grail-memory';
import { successHaptic } from '@/lib/haptics';
import { syncGrowth } from '@/lib/leaderboard';
import { applyReminder } from '@/lib/reminders';
import { getActiveAiConfig, getReminderSettings, setReminderSettings, type ReminderSettings } from '@/lib/settings';
import { reflectOnEntry } from '@/lib/witness';

const RECENT_LIMIT = 60;
/** 隔了这么多天再回来，就说一声“欢迎回来”。 */
const WELCOME_BACK_AFTER_DAYS = 3;
const HERO_CANVAS_HEIGHT = 300;
const FAB_SIZE = 64;
const TOAST_MS = 2400;

function groupByDay(entries: Entry[]): { day: string; entries: Entry[] }[] {
  const groups: { day: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last?.day === entry.day) last.entries.push(entry);
    else groups.push({ day: entry.day, entries: [entry] });
  }
  return groups;
}

function heroDate(day: string): string {
  const date = parseDay(day);
  return `${date.getMonth() + 1}月${date.getDate()}日 · 周${'日一二三四五六'[date.getDay()]}`;
}

function cupCaption(days: number): string {
  if (days === 0) return '记下第一件事，圣杯里就有了第一份光';
  return `这一杯 ${grailProgress(days).current} / ${CUP_DAYS}`;
}

function toastFor(days: number): string {
  const { fullCups, current } = grailProgress(days);
  if (days === 1) return '第一份光';
  if (current === CUP_DAYS) return `第 ${fullCups + 1} 杯装满了`;
  return `+1 · 第 ${days} 天`;
}

/** “＋”外面一圈慢慢扩散的光环 */
function FabRing({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      pulse.set(0);
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [active, reduceMotion, pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 0.45 }],
  }));
  return <Animated.View style={[styles.fabRing, ring]} pointerEvents="none" />;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { width } = useWindowDimensions();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [attachments, setAttachments] = useState<Map<number, Attachment[]>>(new Map());
  const [viewing, setViewing] = useState<string | null>(null);
  const [growthDays, setGrowthDays] = useState(0);
  const [welcomeBack, setWelcomeBack] = useState<Entry | null>(null);
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiErrors, setAiErrors] = useState<Record<number, string>>({});
  const [recording, setRecording] = useState(false);
  const [menuFor, setMenuFor] = useState<Entry | null>(null);
  const [confirmDeleteFor, setConfirmDeleteFor] = useState<Entry | null>(null);
  const [categoryFor, setCategoryFor] = useState<Entry | null>(null);
  const [drop, setDrop] = useState<GrailDrop | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const load = useCallback(async () => {
    const today = todayString();
    const recent = await listRecentEntries(db, RECENT_LIMIT);
    let welcome: Entry | null = null;
    if (!recent.some((entry) => entry.day === today)) {
      const last = await getLastEntryBefore(db, today);
      if (last && daysBetween(last.day, today) >= WELCOME_BACK_AFTER_DAYS) welcome = last;
    }
    setEntries(recent);
    setAttachments(await listAttachmentsFor(db, recent.map((entry) => entry.id)));
    setGrowthDays(await countGrowthDays(db));
    setWelcomeBack(welcome);
    setReminder(await getReminderSettings());
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function showToast(text: string) {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((current) => (current?.id === id ? null : current)), TOAST_MS);
  }

  async function runAi(entryId: number) {
    setEntries((current) => current.map((e) => (e.id === entryId ? { ...e, aiStatus: 'pending' } : e)));
    const error = await reflectOnEntry(db, entryId);
    setAiErrors((current) => {
      const next = { ...current };
      if (error) next[entryId] = error;
      else delete next[entryId];
      return next;
    });
    await load();
  }

  async function save(draft: RecordDraft) {
    setRecording(false);
    setNotice(null);
    let entryId: number;
    let aiReady: boolean;
    let daysBefore: number;
    let daysAfter: number;
    try {
      daysBefore = await countGrowthDays(db);
      const now = new Date();
      const takeaway = draft.takeaway || null;
      const guessed = guessCategory(`${draft.content} ${takeaway ?? ''}`);
      aiReady = (await getActiveAiConfig()) !== null;
      entryId = await insertEntry(db, {
        createdAt: now.toISOString(),
        day: toDayString(now),
        content: draft.content,
        takeaway,
        category: guessed,
        categorySource: guessed ? 'guess' : null,
        aiStatus: aiReady ? 'pending' : 'skipped',
      });
      daysAfter = await countGrowthDays(db);
    } catch {
      setNotice('没有记上，请再试一次。');
      return;
    }
    if (draft.images.length > 0) {
      try {
        await saveAttachments(db, entryId, draft.images);
      } catch {
        setNotice('图片没有存上，记录已经保存。');
      }
    }
    await load();
    // 今天的第一件事：一颗光点落进圣杯；之后再记，就只轻轻震一下
    if (daysAfter > daysBefore) {
      setDrop({ id: Date.now(), from: daysBefore, to: daysAfter });
      void setCelebratedDays(daysAfter);
    } else {
      successHaptic();
      showToast('记下了');
    }
    void syncGrowth(db);
    if (aiReady) await runAi(entryId);
  }

  async function enableReminder() {
    if (!reminder) return;
    const result = await applyReminder({ ...reminder, enabled: true });
    const next = { ...reminder, enabled: result === 'scheduled', prompted: true };
    await setReminderSettings(next);
    setReminder(next);
    setNotice(result === 'scheduled' ? `好，每晚 ${formatTime(next.hour, next.minute)} 见。` : '通知权限没有打开，可以在“我的”里重新开启。');
  }

  async function dismissReminderInvite() {
    if (!reminder) return;
    const next = { ...reminder, prompted: true };
    await setReminderSettings(next);
    setReminder(next);
  }

  const showReminderInvite = Platform.OS !== 'web' && reminder !== null && !reminder.prompted && entries.length > 0;
  const groups = groupByDay(entries);
  const today = todayString();
  const stageWidth = Math.min(width, MaxContentWidth);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: FAB_SIZE + Spacing.six + WEB_TAB_BAR_SPACE }}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { paddingTop: insets.top + Spacing.three }]}>
          <View style={[styles.heroInner, { width: stageWidth }]}>
            <View style={styles.heroTop}>
              <ThemedText style={styles.heroDate}>{heroDate(today)}</ThemedText>
              {growthDays > 0 ? (
                <View style={styles.dayPill}>
                  <ThemedText style={styles.dayPillText}>第 {growthDays} 天</ThemedText>
                </View>
              ) : null}
            </View>
            <GrailHero
              width={stageWidth}
              height={HERO_CANVAS_HEIGHT}
              days={growthDays}
              drop={drop}
              active={focused}
              onDropLanded={() => {
                successHaptic();
                if (drop) showToast(toastFor(drop.to));
              }}
            />
            <View style={styles.cupRow}>
              <ThemedText style={styles.cupText}>{cupCaption(growthDays)}</ThemedText>
              {growthDays > 0 ? (
                <InfoButton
                  title="这一杯"
                  lines={['每天第一次记下一件事，就有一颗光点落进杯里。', '每 100 个有记录的日子装满一杯，装满就开始倒新的一杯。']}
                  color={Hero.textSecondary}
                  size={16}
                />
              ) : null}
            </View>
            {toast ? (
              <Animated.View
                key={toast.id}
                entering={FadeInDown.springify().damping(14)}
                exiting={FadeOutUp.duration(400)}
                style={styles.toast}
                pointerEvents="none">
                <ThemedText style={styles.toastText}>{toast.text}</ThemedText>
              </Animated.View>
            ) : null}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.contentInner}>
            {welcomeBack ? (
              <Card tone="soft">
                <ThemedText type="small">欢迎回来。上一次，你记的是「{welcomeBack.content}」。</ThemedText>
              </Card>
            ) : null}

            {showReminderInvite ? (
              <Card tone="soft">
                <ThemedText type="small">每晚 {formatTime(reminder.hour, reminder.minute)} 轻轻问你一句？没记也不会追问。</ThemedText>
                <View style={styles.row}>
                  <Button title="打开提醒" onPress={enableReminder} />
                  <TextButton title="不用了" tone="muted" onPress={dismissReminderInvite} />
                </View>
              </Card>
            ) : null}
            {notice ? <ThemedText type="caption">{notice}</ThemedText> : null}

            {entries.length === 0 ? (
              <View style={styles.empty}>
                <ThemedText type="small" themeColor="textSecondary">
                  点下面的 ＋，记下今天让自己变好的一件事
                </ThemedText>
                <InfoButton
                  title="记什么都算"
                  lines={[
                    '读了几页书、跑了一段路、好好睡了一觉、和家人聊了聊、比以前更耐心了一点，都算。',
                    '每记一件，AI 会对照你以前的记录，用一两句话告诉你哪里变了。',
                  ]}
                />
              </View>
            ) : null}

            {groups.map((group) => (
              <View key={group.day} style={styles.group}>
                <View style={styles.groupHeader}>
                  <ThemedText type="subtitle">{formatDayLabel(group.day, today)}</ThemedText>
                  <ThemedText type="caption">{group.entries.length} 件</ThemedText>
                </View>
                {group.entries.map((entry, index) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    imageUris={(attachments.get(entry.id) ?? []).map(attachmentUri)}
                    errorMessage={aiErrors[entry.id]}
                    onChangeCategory={() => setCategoryFor(entry)}
                    onRetry={() => runAi(entry.id)}
                    onMore={() => setMenuFor(entry)}
                    onSetupAi={() => router.navigate('/settings/ai')}
                    onOpenImage={setViewing}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.fabWrap, { bottom: Spacing.four + WEB_TAB_BAR_SPACE }]} pointerEvents="box-none">
        <FabRing active={focused && !recording} />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="记一件事"
          onPress={() => setRecording(true)}
          scaleTo={0.9}
          style={styles.fab}>
          <PlusIcon size={28} color={Hero.onGold} strokeWidth={2.4} />
        </PressableScale>
      </View>

      <RecordSheet visible={recording} onClose={() => setRecording(false)} onSave={(draft) => void save(draft)} />

      <Sheet
        visible={menuFor !== null}
        title="这条记录"
        message={menuFor?.content}
        onClose={() => setMenuFor(null)}
        actions={
          menuFor
            ? [
                { label: '改方向', onPress: () => setCategoryFor(menuFor) },
                { label: '让 AI 重新看看', onPress: () => runAi(menuFor.id) },
                { label: '删除', destructive: true, onPress: () => setConfirmDeleteFor(menuFor) },
              ]
            : []
        }
      />

      <Sheet
        visible={confirmDeleteFor !== null}
        title="删掉这条记录？"
        message={confirmDeleteFor ? `「${confirmDeleteFor.content}」和它的图片删除后找不回来。` : undefined}
        onClose={() => setConfirmDeleteFor(null)}
        actions={
          confirmDeleteFor
            ? [
                {
                  label: '删除',
                  destructive: true,
                  onPress: async () => {
                    await deleteEntryAndAttachments(db, confirmDeleteFor.id);
                    await load();
                    void syncGrowth(db);
                  },
                },
              ]
            : []
        }
      />

      <ImageViewer uri={viewing} onClose={() => setViewing(null)} />

      <CategoryPicker
        visible={categoryFor !== null}
        current={categoryFor?.category ?? null}
        onClose={() => setCategoryFor(null)}
        onSelect={async (category) => {
          if (!categoryFor) return;
          await setEntryCategory(db, categoryFor.id, category);
          await load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hero: {
    backgroundColor: Hero.background,
    borderBottomLeftRadius: Radius.hero,
    borderBottomRightRadius: Radius.hero,
    alignItems: 'center',
    paddingBottom: Spacing.four,
    overflow: 'hidden',
  },
  heroInner: {
    alignItems: 'center',
  },
  heroTop: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    minHeight: 32,
  },
  heroDate: {
    fontSize: 13,
    letterSpacing: 1,
    color: Hero.textSecondary,
  },
  dayPill: {
    backgroundColor: Hero.raised,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dayPillText: {
    fontSize: 13,
    fontWeight: 600,
    color: Hero.gold,
  },
  cupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: -Spacing.three,
  },
  cupText: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    color: Hero.text,
  },
  toast: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toastText: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 700,
    color: Hero.gold,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    alignItems: 'center',
  },
  contentInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  group: {
    gap: Spacing.two + 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fabRing: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#D9A441',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Hero.goldDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
