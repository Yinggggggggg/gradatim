import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AnimatedBar } from '@/components/animated-bar';
import { FullCups, Grail } from '@/components/grail';
import { Heatmap } from '@/components/heatmap';
import { InfoButton } from '@/components/info-button';
import { ThemedText } from '@/components/themed-text';
import { Card, Screen } from '@/components/ui';
import { WeeklyCard } from '@/components/weekly-card';
import { Fonts, Hero, Radius, Spacing } from '@/constants/theme';
import { useCountUp } from '@/hooks/use-count-up';
import { useWeeklyReports } from '@/hooks/use-weekly-reports';
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from '@/lib/categories';
import { addDays, daysBetween, formatFullDate, todayString, weekStartOf } from '@/lib/dates';
import { countGrowthDays, type Entry, getCategoryCounts, getDayCounts, getFirstEntry } from '@/lib/db';
import { CUP_DAYS, grailProgress } from '@/lib/grail';
import { getCelebratedDays, setCelebratedDays } from '@/lib/grail-memory';

const HEATMAP_WEEKS = 18;
const DEPTH_WINDOW_DAYS = 90;
/** 三个月里某个方向至少出现这么多次，并且占到这么大比例，才轻轻问一句要不要往深里走。 */
const DEPTH_MIN_COUNT = 8;
const DEPTH_MIN_SHARE = 0.35;

type Depth = { category: CategoryKey; count: number };

function cupLine(days: number): string {
  if (days === 0) return '记下第一件事，圣杯里就有了第一份光';
  const { fullCups, current } = grailProgress(days);
  if (current === CUP_DAYS) return `第 ${fullCups + 1} 杯装满了`;
  return `第 ${fullCups + 1} 杯 · 还差 ${CUP_DAYS - current} 天装满`;
}

export default function GrowthScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const focused = useIsFocused();
  const weekly = useWeeklyReports();

  const [growthDays, setGrowthDays] = useState(0);
  const [animateFrom, setAnimateFrom] = useState<number | null>(null);
  const [firstEntry, setFirstEntry] = useState<Entry | null>(null);
  const [dayCounts, setDayCounts] = useState<Map<string, number>>(new Map());
  const [categoryCounts, setCategoryCounts] = useState<Partial<Record<CategoryKey, number>>>({});
  const [depth, setDepth] = useState<Depth | null>(null);
  // 每次切到这一页都换一次，让热力图和方向条重新长一遍
  const [visit, setVisit] = useState(0);
  const today = todayString();
  const shownDays = useCountUp(growthDays);

  const load = useCallback(async () => {
    const now = todayString();
    const heatmapStart = weekStartOf(addDays(now, -(HEATMAP_WEEKS - 1) * 7));
    const days = await countGrowthDays(db);
    // 天数涨了却没看到光点落下，就在这里补放一次
    const celebrated = await getCelebratedDays();
    setAnimateFrom(celebrated !== null && celebrated < days ? celebrated : null);
    setGrowthDays(days);
    await setCelebratedDays(days);
    setFirstEntry(await getFirstEntry(db));
    setDayCounts(await getDayCounts(db, heatmapStart));
    setCategoryCounts(await getCategoryCounts(db));

    const recent = await getCategoryCounts(db, addDays(now, -DEPTH_WINDOW_DAYS));
    const total = CATEGORY_KEYS.reduce((sum, key) => sum + (recent[key] ?? 0), 0);
    const top = CATEGORY_KEYS.reduce<CategoryKey>((best, key) => ((recent[key] ?? 0) > (recent[best] ?? 0) ? key : best), 'body');
    const topCount = recent[top] ?? 0;
    setDepth(topCount >= DEPTH_MIN_COUNT && topCount / total >= DEPTH_MIN_SHARE ? { category: top, count: topCount } : null);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      setVisit((n) => n + 1);
      void load();
    }, [load]),
  );

  const { fullCups } = grailProgress(growthDays);
  const maxCount = Math.max(1, ...CATEGORY_KEYS.map((key) => categoryCounts[key] ?? 0));
  const heatmapStart = weekStartOf(addDays(today, -(HEATMAP_WEEKS - 1) * 7));
  const windowDays = daysBetween(heatmapStart, today) + 1;
  const recordedDays = [...dayCounts.values()].filter((n) => n > 0).length;

  return (
    <Screen>
      <View style={styles.titleRow}>
        <ThemedText type="title">成长</ThemedText>
        <InfoButton
          title="成长怎么算"
          lines={[
            '有记录的日子累计起来就是成长天数。只增不减，中断了也不清零。',
            '每 100 个成长日装满一杯圣杯，装满就开始倒新的一杯。',
          ]}
        />
      </View>

      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
        <Grail days={growthDays} size={64} animateFrom={animateFrom} idle={focused} />
        <View style={styles.heroText}>
          <View style={styles.bigNumber}>
            <ThemedText style={styles.number}>{shownDays}</ThemedText>
            <ThemedText style={styles.unit}>天</ThemedText>
          </View>
          <ThemedText type="small" style={styles.heroCaption}>
            {cupLine(growthDays)}
          </ThemedText>
          {firstEntry ? (
            <ThemedText type="caption" style={styles.heroCaption}>
              从 {formatFullDate(firstEntry.day)} 开始
            </ThemedText>
          ) : null}
        </View>
      </Animated.View>
      {fullCups > 0 ? (
        <View style={styles.fullCups}>
          <ThemedText type="caption">已经装满 {fullCups} 杯</ThemedText>
          <FullCups count={fullCups} />
        </View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
        <Card>
          <View style={styles.cardHeader}>
            <ThemedText type="smallBold">最近四个月</ThemedText>
            <ThemedText type="caption">
              {windowDays} 天里记了 {recordedDays} 天
            </ThemedText>
          </View>
          <Heatmap key={`heatmap-${visit}`} counts={dayCounts} today={today} weeks={HEATMAP_WEEKS} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(160).springify().damping(18)}>
        <Card>
          <ThemedText type="smallBold">方向</ThemedText>
          {CATEGORY_KEYS.map((key, index) => {
            const count = categoryCounts[key] ?? 0;
            const { label, color } = CATEGORIES[key];
            return (
              <View key={key} style={styles.mapRow}>
                <ThemedText type="small" style={styles.mapLabel}>
                  {label}
                </ThemedText>
                <AnimatedBar key={`${key}-${visit}`} fraction={count / maxCount} color={color} delay={200 + index * 70} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.mapCount}>
                  {count}
                </ThemedText>
              </View>
            );
          })}
        </Card>
      </Animated.View>

      {depth ? (
        <Card tone="soft">
          <ThemedText type="small">
            这三个月，「{CATEGORIES[depth.category].label}」有 {depth.count} 次。要不要往深里走一步？
          </ThemedText>
        </Card>
      ) : null}

      <Animated.View entering={FadeInDown.delay(240).springify().damping(18)}>
        <WeeklyCard
          weekStart={weekly.currentWeek}
          report={weekly.reports.get(weekly.currentWeek)}
          entryCount={weekly.currentWeekCount}
          generating={weekly.generating === weekly.currentWeek}
          aiError={weekly.aiError}
          onGenerate={() => void weekly.generate(weekly.currentWeek)}
          onOpenHistory={() => router.push('/growth/weekly')}
        />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hero: {
    backgroundColor: Hero.background,
    borderRadius: Radius.large,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  bigNumber: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  number: {
    fontFamily: Fonts.serif,
    fontSize: 52,
    lineHeight: 60,
    fontWeight: 700,
    color: Hero.gold,
  },
  unit: {
    fontSize: 16,
    color: Hero.text,
  },
  heroCaption: {
    color: Hero.textSecondary,
  },
  fullCups: {
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  mapLabel: {
    width: 36,
  },
  mapCount: {
    width: 32,
    textAlign: 'right',
  },
});
