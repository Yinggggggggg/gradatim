import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Hero, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BoardRow } from '@/lib/leaderboard';

/** 第一名在中间最高，第二名在左，第三名在右 */
const SLOTS = [
  { place: 1, height: 92, avatar: 50, ring: '#C9CDD3', delay: 100 },
  { place: 0, height: 126, avatar: 62, ring: '#E2B44E', delay: 0 },
  { place: 2, height: 72, avatar: 50, ring: '#C98A5A', delay: 200 },
];

function Step({ row, height, avatar, ring, delay, first }: { row: BoardRow; height: number; avatar: number; ring: string; delay: number; first: boolean }) {
  const theme = useTheme();
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(delay, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })));
  }, [grow, delay]);
  const block = useAnimatedStyle(() => ({ height: height * grow.get() }));

  return (
    <View style={styles.slot}>
      <Animated.View entering={ZoomIn.delay(delay + 450).springify().damping(12)} style={[styles.ring, { borderColor: ring }]}>
        <Avatar uri={row.avatarUrl} name={row.nickname} size={avatar} />
      </Animated.View>
      <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
        {row.nickname}
        {row.isMe ? '（你）' : ''}
      </ThemedText>
      <Animated.View style={[styles.block, { backgroundColor: first ? Hero.background : theme.border }, block]}>
        <ThemedText style={[styles.rank, { color: first ? Hero.gold : theme.textSecondary }]}>{row.rank}</ThemedText>
        <ThemedText type="caption" style={first ? { color: Hero.text } : undefined}>
          {row.growthDays} 天
        </ThemedText>
      </Animated.View>
    </View>
  );
}

/** 排行榜前三名的领奖台：台子从下往上升起，头像随后弹出来。 */
export function Podium({ rows }: { rows: BoardRow[] }) {
  const top = rows.filter((row) => row.rank <= 3).slice(0, 3);
  if (top.length === 0) return null;
  return (
    <View style={styles.podium}>
      {SLOTS.map((slot) => {
        const row = top[slot.place];
        if (!row) return <View key={slot.place} style={styles.slot} />;
        return <Step key={slot.place} row={row} {...slot} first={slot.place === 0} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two + 2,
    minHeight: 236,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  ring: {
    borderWidth: 3,
    borderRadius: 999,
    padding: 2,
  },
  name: {
    maxWidth: '100%',
  },
  block: {
    alignSelf: 'stretch',
    borderTopLeftRadius: Radius.medium,
    borderTopRightRadius: Radius.medium,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
    paddingTop: Spacing.two,
    overflow: 'hidden',
  },
  rank: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
});
