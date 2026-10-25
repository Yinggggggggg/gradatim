import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextButton } from '@/components/ui';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isWeekReportReady } from '@/lib/dates';
import type { WeeklyReport } from '@/lib/db';

/** 成长页底部的“这周的你”：写好了就显示周报，没写好就告诉你周日晚上见。 */
export function WeeklyCard({
  weekStart,
  report,
  entryCount,
  generating,
  aiError,
  onGenerate,
  onOpenHistory,
}: {
  weekStart: string;
  report: WeeklyReport | undefined;
  entryCount: number;
  generating: boolean;
  aiError: string | null;
  onGenerate: () => void;
  onOpenHistory: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.accentSoft }]}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ color: theme.accent }}>
          这周的你
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={onOpenHistory} hitSlop={10}>
          <ThemedText type="small" style={{ color: theme.accent }}>
            往期 ›
          </ThemedText>
        </Pressable>
      </View>

      {generating ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={theme.accent} />
          <ThemedText type="small" themeColor="textSecondary">
            正在写这周的你…
          </ThemedText>
        </View>
      ) : report ? (
        <>
          <ThemedText style={styles.summary}>{report.summary}</ThemedText>
          {report.highlights.length > 0 ? (
            <View style={styles.chips}>
              {report.highlights.map((highlight, index) => (
                <View key={index} style={[styles.chip, { backgroundColor: theme.card }]}>
                  <ThemedText type="caption" style={{ color: theme.accent }}>
                    {highlight}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {report.comparison}
          </ThemedText>
          <View style={styles.footer}>
            <TextButton title="重新写" tone="muted" onPress={onGenerate} />
          </View>
        </>
      ) : entryCount > 0 ? (
        <View style={styles.row}>
          <ThemedText type="small" style={styles.flex}>
            {isWeekReportReady(weekStart) ? `这周记了 ${entryCount} 件。` : `周日晚上见 · 这周已记 ${entryCount} 件`}
          </ThemedText>
          <TextButton title={isWeekReportReady(weekStart) ? '写周报' : '提前看看'} onPress={onGenerate} />
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          这周还没有记录。
        </ThemedText>
      )}

      {aiError ? (
        <ThemedText type="caption" style={{ color: theme.danger }}>
          AI 没能写（{aiError}），先给你一份本地统计版。
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  summary: {
    fontFamily: Fonts.serif,
    lineHeight: 26,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  footer: {
    alignItems: 'flex-end',
  },
});
