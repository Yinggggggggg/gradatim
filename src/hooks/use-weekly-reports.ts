import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import { isWeekReportReady, todayString, weekStartOf } from '@/lib/dates';
import { listDistinctDays, listEntriesForWeek, listWeeklyReports, type WeeklyReport } from '@/lib/db';
import { generateWeeklyReport } from '@/lib/witness';

// 同一周只自动生成一次，成长页和往期周报页共用
const autoTried = new Set<string>();

/** 周报：有记录的每一周、已经写好的周报、这周记了几件，以及生成周报。周日晚上第一次打开时自动写好这周的。 */
export function useWeeklyReports() {
  const db = useSQLiteContext();
  const [weeks, setWeeks] = useState<string[]>([]);
  const [reports, setReports] = useState<Map<string, WeeklyReport>>(new Map());
  const [currentWeekCount, setCurrentWeekCount] = useState(0);
  const [generating, setGenerating] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const generate = useCallback(
    async (weekStart: string) => {
      setGenerating(weekStart);
      setAiError(null);
      try {
        const { report, aiError: error } = await generateWeeklyReport(db, weekStart);
        setReports((current) => new Map(current).set(weekStart, report));
        setAiError(error);
      } finally {
        setGenerating(null);
      }
    },
    [db],
  );

  const load = useCallback(async () => {
    const thisWeek = weekStartOf(todayString());
    const days = await listDistinctDays(db);
    const weekStarts = [...new Set([thisWeek, ...days.map(weekStartOf)])].sort().reverse();
    const saved = new Map((await listWeeklyReports(db)).map((report) => [report.weekStart, report]));
    const thisWeekCount = (await listEntriesForWeek(db, thisWeek)).length;
    setWeeks(weekStarts);
    setReports(saved);
    setCurrentWeekCount(thisWeekCount);

    if (isWeekReportReady(thisWeek) && !saved.has(thisWeek) && thisWeekCount > 0 && !autoTried.has(thisWeek)) {
      autoTried.add(thisWeek);
      await generate(thisWeek);
    }
  }, [db, generate]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return {
    weeks,
    reports,
    currentWeek: weekStartOf(todayString()),
    currentWeekCount,
    generating,
    aiError,
    generate,
  };
}
