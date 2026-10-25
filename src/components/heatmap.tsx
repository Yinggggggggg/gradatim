import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { addDays, parseDay, weekStartOf } from '@/lib/dates';

const GAP = 3;

/** 最近若干周的日历格子：哪天记了就点亮，记得越多颜色越深。只有点亮，没有“断了”。 */
export function Heatmap({ counts, today, weeks }: { counts: Map<string, number>; today: string; weeks: number }) {
  const theme = useTheme();
  const firstMonday = weekStartOf(addDays(today, -(weeks - 1) * 7));

  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(firstMonday, w * 7 + d)),
  );

  function colorFor(day: string): string {
    if (day > today) return 'transparent';
    const n = counts.get(day) ?? 0;
    if (n === 0) return theme.border;
    if (n === 1) return `${theme.accent}66`;
    if (n === 2) return `${theme.accent}AA`;
    return theme.accent;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        {columns.map((column) => {
          const firstOfMonth = column.find((day) => parseDay(day).getDate() === 1);
          const label = firstOfMonth ? `${parseDay(firstOfMonth).getMonth() + 1}月` : '';
          return (
            <View key={column[0]} style={[styles.column, styles.monthCell]}>
              {label ? (
                <ThemedText type="caption" style={styles.monthLabel}>
                  {label}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {columns.map((column, w) => (
          <View key={column[0]} style={[styles.column, { gap: GAP }]}>
            {column.map((day, d) => (
              <Animated.View
                key={day}
                // 从左到右一列一列亮起来
                entering={ZoomIn.delay(w * 28 + d * 6).duration(320)}
                accessibilityLabel={`${day}：${counts.get(day) ?? 0} 条记录`}
                style={[styles.cell, { backgroundColor: colorFor(day) }]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  column: {
    flex: 1,
  },
  // 月份文字比一格宽，让它从这一列开始向右溢出，不要被截断
  monthCell: {
    height: 12,
    overflow: 'visible',
  },
  monthLabel: {
    position: 'absolute',
    left: 0,
    width: 40,
    fontSize: 10,
    lineHeight: 12,
  },
  cell: {
    aspectRatio: 1,
    borderRadius: 3,
  },
});
