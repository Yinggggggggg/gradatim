/**
 * 把记录、AI 和数据库串起来：给一条记录写回应，给一周写周报。
 * 没有 AI 密钥时，周报退回到本地统计版，照样能看。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { describeAiError, getAiProvider, type WeeklyDraft } from './ai';
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from './categories';
import { formatFullDate, todayString } from './dates';
import {
  countGrowthDays,
  type Entry,
  getEntry,
  getFirstEntry,
  listAllEntries,
  listEntriesForWeek,
  saveWeeklyReport,
  updateEntryAi,
  type WeeklyReport,
} from './db';
import { selectRelated } from './relevance';

const RELATED_FOR_ENTRY = 12;
const RELATED_PER_WEEK_ENTRY = 3;
const MAX_EARLIER_FOR_WEEK = 24;

function isBefore(a: Entry, b: Entry): boolean {
  return a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id);
}

/** 让 AI 看一条记录。成功返回 null，失败返回一句错误说明。 */
export async function reflectOnEntry(db: SQLiteDatabase, entryId: number): Promise<string | null> {
  const entry = await getEntry(db, entryId);
  if (!entry) return null;
  const provider = await getAiProvider();
  if (!provider) {
    await updateEntryAi(db, entryId, { aiStatus: 'skipped' });
    return null;
  }

  await updateEntryAi(db, entryId, { aiStatus: 'pending' });
  try {
    const earlier = (await listAllEntries(db)).filter((other) => isBefore(other, entry));
    const { entries: related, total } = selectRelated(entry, earlier, RELATED_FOR_ENTRY);
    const result = await provider.reflect({
      today: todayString(),
      entry,
      related,
      relatedTotal: total,
      entryNumber: earlier.length + 1,
      growthDays: await countGrowthDays(db),
    });
    if (entry.categorySource === 'user' || result.category === null) {
      await updateEntryAi(db, entryId, { aiStatus: 'done', aiReply: result.reply });
    } else {
      await updateEntryAi(db, entryId, { aiStatus: 'done', aiReply: result.reply, category: result.category });
    }
    return null;
  } catch (error) {
    await updateEntryAi(db, entryId, { aiStatus: 'error' });
    return describeAiError(error);
  }
}

function pickEarlierForWeek(weekEntries: Entry[], earlierAll: Entry[]): Entry[] {
  const picked = new Map<number, Entry>();
  for (const entry of weekEntries) {
    for (const related of selectRelated(entry, earlierAll, RELATED_PER_WEEK_ENTRY).entries) {
      picked.set(related.id, related);
    }
  }
  const sorted = [...picked.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (sorted.length <= MAX_EARLIER_FOR_WEEK) return sorted;
  // 太多时保留最早的一半和最近的一半，两头都有得对比
  const half = MAX_EARLIER_FOR_WEEK / 2;
  return [...sorted.slice(0, half), ...sorted.slice(-half)];
}

function localWeeklyDraft(weekEntries: Entry[], growthDays: number, first: Entry | null, weekStart: string): WeeklyDraft {
  const counts = new Map<CategoryKey, number>();
  for (const entry of weekEntries) {
    if (entry.category) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  const top = CATEGORY_KEYS.filter((key) => counts.has(key)).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))[0];
  const summary =
    weekEntries.length === 0
      ? '这周还没有记录。'
      : `这周你记下了 ${weekEntries.length} 件事${top ? `，最多的是「${CATEGORIES[top].label}」（${counts.get(top)} 件）` : ''}。`;
  const highlights = weekEntries
    .slice()
    .reverse()
    .map((entry) => entry.takeaway ?? entry.content)
    .slice(0, 3);
  const comparison =
    first && first.day < weekStart
      ? `你的第一条记录是${formatFullDate(first.day)}的「${first.content}」。到现在，有记录的日子一共 ${growthDays} 天。`
      : '这是你开始记录的第一周。';
  return { summary, highlights, comparison };
}

/** 生成并保存一周的周报。AI 失败时保存本地统计版，并把失败原因一起返回。 */
export async function generateWeeklyReport(
  db: SQLiteDatabase,
  weekStart: string,
): Promise<{ report: WeeklyReport; aiError: string | null }> {
  const weekEntries = await listEntriesForWeek(db, weekStart);
  const growthDays = await countGrowthDays(db);
  const provider = await getAiProvider();

  let draft: WeeklyDraft | null = null;
  let aiError: string | null = null;
  if (provider && weekEntries.length > 0) {
    try {
      const earlierAll = (await listAllEntries(db)).filter((entry) => entry.day < weekStart);
      draft = await provider.writeWeekly({
        weekStart,
        weekEntries,
        earlier: pickEarlierForWeek(weekEntries, earlierAll),
        growthDays,
      });
    } catch (error) {
      aiError = describeAiError(error);
    }
  }

  const source = draft ? 'ai' : 'local';
  const content = draft ?? localWeeklyDraft(weekEntries, growthDays, await getFirstEntry(db), weekStart);
  const report: WeeklyReport = {
    weekStart,
    createdAt: new Date().toISOString(),
    ...content,
    entryCount: weekEntries.length,
    source,
  };
  await saveWeeklyReport(db, report);
  return { report, aiError };
}
