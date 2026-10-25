import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, TextButton } from '@/components/ui';
import { Fonts, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatWeekRange } from '@/lib/dates';
import type { WeeklyReport } from '@/lib/db';

export function ReportCard({
  report,
  onRegenerate,
  regenerating,
}: {
  report: WeeklyReport;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="smallBold">{formatWeekRange(report.weekStart)}</ThemedText>
        <ThemedText type="caption">
          {report.entryCount} 件{report.source === 'local' ? ' · 本地统计' : ''}
        </ThemedText>
      </View>

      <ThemedText style={styles.summary}>{report.summary}</ThemedText>

      {report.highlights.length > 0 ? (
        <View style={styles.chips}>
          {report.highlights.map((highlight, index) => (
            <View key={index} style={[styles.chip, { backgroundColor: theme.accentSoft }]}>
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
        <TextButton
          title={regenerating ? '正在重新写…' : '重新写'}
          tone="muted"
          onPress={onRegenerate}
          disabled={regenerating}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  summary: {
    fontFamily: Fonts.serif,
    lineHeight: 26,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: Radius.large,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  footer: {
    alignItems: 'flex-end',
  },
});
