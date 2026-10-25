import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { InfoButton } from '@/components/info-button';
import { LoginSheet } from '@/components/login-sheet';
import { Podium } from '@/components/podium';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen, TextButton } from '@/components/ui';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useCloudUser } from '@/hooks/use-cloud-user';
import { useTheme } from '@/hooks/use-theme';
import { CloudError, isCloudConfigured } from '@/lib/cloud';
import { type Board, type BoardRow, fetchBoard, joinBoard, leaveBoard, syncAvatar, syncGrowth } from '@/lib/leaderboard';
import { getProfile, NICKNAME_MAX, saveProfile } from '@/lib/profile';

function messageOf(error: unknown): string {
  return error instanceof CloudError ? error.message : '排行榜加载失败，过一会儿再试';
}

/** 一圈慢慢呼吸的金框，标出“我” */
function Glow({ radius }: { radius: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(0.35);
    pulse.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduceMotion, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 2, borderColor: theme.accent }, style]}
    />
  );
}

function RankRow({ row, index, gapBefore }: { row: BoardRow; index: number; gapBefore: boolean }) {
  const theme = useTheme();
  return (
    <Fragment>
      {gapBefore ? (
        <ThemedText type="caption" style={styles.gap}>
          ⋯
        </ThemedText>
      ) : null}
      <Animated.View
        entering={FadeInRight.delay(500 + index * 60).springify().damping(18)}
        style={[styles.rankRow, row.isMe && { backgroundColor: theme.accentSoft }]}>
        {row.isMe ? <Glow radius={Radius.medium} /> : null}
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.rankNumber}>
          {row.rank}
        </ThemedText>
        <Avatar uri={row.avatarUrl} name={row.nickname} size={32} />
        <ThemedText type={row.isMe ? 'smallBold' : 'small'} numberOfLines={1} style={styles.flex}>
          {row.nickname}
          {row.isMe ? '（你）' : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {row.growthDays} 天
        </ThemedText>
      </Animated.View>
    </Fragment>
  );
}

export default function BoardScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { user } = useCloudUser();
  const configured = isCloudConfigured();

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // 每次切到这一页换一次，让领奖台重新升起来
  const [visit, setVisit] = useState(0);

  const load = useCallback(async () => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    // 加入时默认用主页上的昵称
    const profile = await getProfile();
    setNickname((current) => current || profile.nickname);
    try {
      // 先把最新的天数、昵称和头像报上去，再看排名；头像传不上去不耽误看排名
      await syncGrowth(db);
      await syncAvatar().catch(() => undefined);
      setBoard(await fetchBoard());
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
    }
  }, [db, configured]);

  useFocusEffect(
    useCallback(() => {
      setVisit((n) => n + 1);
      void load();
    }, [load]),
  );

  async function join() {
    setJoining(true);
    setError(null);
    try {
      // 昵称记到主页上，以后在主页改，排行榜跟着改
      const profile = await getProfile();
      await saveProfile({ ...profile, nickname });
      await joinBoard(db, nickname);
      await load();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setJoining(false);
    }
  }

  async function leave() {
    try {
      await leaveBoard();
      await load();
    } catch (e) {
      setError(messageOf(e));
    }
  }

  const me = board?.me ?? null;
  const others = board?.rows.filter((row) => row.rank > 3) ?? [];

  return (
    <Screen>
      <View style={styles.titleRow}>
        <ThemedText type="title">排行</ThemedText>
        <InfoButton
          title="排行怎么比"
          lines={[
            '比的是累计成长天数：有记录的日子一共多少天，只增不减，中断了也不清零。',
            '只上传昵称、天数和主页上的头像，记录内容不会离开手机。随时可以退出。',
          ]}
        />
      </View>

      {!configured ? (
        <Card tone="soft">
          <ThemedText type="small">排行榜还没开通。</ThemedText>
        </Card>
      ) : (
        <>
          {!user ? (
            <Card tone="soft">
              <ThemedText type="small">登录后加入排行榜，看看大家坚持了多少天。</ThemedText>
              <View>
                <Button title="用邮箱登录" onPress={() => setLoggingIn(true)} />
              </View>
            </Card>
          ) : !me && board ? (
            <Card tone="soft">
              <ThemedText type="smallBold">起个昵称，加入排行榜</ThemedText>
              <View style={styles.joinRow}>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder={`1 到 ${NICKNAME_MAX} 个字`}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={NICKNAME_MAX}
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                />
                <Button title="加入" onPress={join} loading={joining} disabled={!nickname.trim()} />
              </View>
            </Card>
          ) : null}

          {error ? (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          ) : null}

          {!board && loading ? <ActivityIndicator color={theme.accent} /> : null}
          {board && board.rows.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              还没有人加入，你可以当第一个。
            </ThemedText>
          ) : null}

          {board ? <Podium key={`podium-${visit}`} rows={board.rows} /> : null}

          {me ? (
            <Animated.View entering={FadeInDown.delay(350).springify().damping(18)} style={[styles.meCard, { backgroundColor: theme.card }]}>
              <Glow radius={Radius.large} />
              <Avatar uri={me.avatarUrl} name={me.nickname} size={48} />
              <View style={styles.flex}>
                <ThemedText style={[styles.meRank, { color: theme.accent }]}>第 {me.rank} 名</ThemedText>
                <ThemedText type="caption">
                  共 {board?.total ?? 0} 人 · {me.growthDays} 天
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}

          {others.length > 0 ? (
            <Card>
              {others.map((row, index) => {
                const previous = index === 0 ? 3 : others[index - 1].rank;
                return <RankRow key={`${row.rank}-${row.nickname}-${index}`} row={row} index={index} gapBefore={row.rank - previous > 1} />;
              })}
            </Card>
          ) : null}

          {me ? (
            <View style={styles.footer}>
              <TextButton title="刷新" tone="muted" onPress={load} />
              <TextButton title="退出排行榜" tone="muted" onPress={() => setConfirmingLeave(true)} />
            </View>
          ) : null}
        </>
      )}

      <LoginSheet
        visible={loggingIn}
        onClose={() => {
          setLoggingIn(false);
          void load();
        }}
      />
      <Sheet
        visible={confirmingLeave}
        title="退出排行榜？"
        message="昵称、天数和头像会从排行榜上删掉。之后想回来，随时可以重新加入。"
        onClose={() => setConfirmingLeave(false)}
        actions={[{ label: '退出排行榜', destructive: true, onPress: leave }]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.large,
    padding: Spacing.three,
  },
  meRank: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: 700,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.medium,
  },
  rankNumber: {
    width: 28,
    textAlign: 'right',
  },
  flex: {
    flex: 1,
  },
  gap: {
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
