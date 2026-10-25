import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ReportCard } from '@/components/report-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWeeklyReports } from '@/hooks/use-weekly-reports';
import { formatWeekRange, isWeekReportReady } from '@/lib/dates';

/** 往期周报：有记录的每一周，写好的显示出来，没写的可以补写。 */
export default function WeeklyHistoryScreen() {
  const theme = useTheme();
  const { weeks, reports, currentWeek, generating, aiError, generate } = useWeeklyReports();
  // 这一周还没到周日的，在成长页那张卡片里看
  const pastWeeks = weeks.filter((week) => week !== currentWeek || isWeekReportReady(week) || reports.has(week));

  return (
    <Screen underHeader>
      {aiError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          AI 没能写这份周报（{aiError}），先给你一份本地统计版。
        </ThemedText>
      ) : null}

      {pastWeeks.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          还没有往期周报。
        </ThemedText>
      ) : null}

      {pastWeeks.map((weekStart, index) => {
        const report = reports.get(weekStart);
        const isGenerating = generating === weekStart;
        return (
          <Animated.View key={weekStart} entering={FadeInDown.delay(index * 60).springify().damping(18)}>
            {report ? (
              <ReportCard report={report} regenerating={isGenerating} onRegenerate={() => generate(weekStart)} />
            ) : (
              <Card>
                <ThemedText type="smallBold">{formatWeekRange(weekStart)}</ThemedText>
                {isGenerating ? (
                  <View style={styles.row}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <ThemedText type="small" themeColor="textSecondary">
                      正在写这周的你…
                    </ThemedText>
                  </View>
                ) : (
                  <View>
                    <Button title="补写这周" kind="secondary" onPress={() => generate(weekStart)} disabled={generating !== null} />
                  </View>
                )}
              </Card>
            )}
          </Animated.View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
