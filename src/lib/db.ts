/**
 * 本地数据库：所有记录只存在手机里。
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { type CategoryKey, normalizeCategory } from './categories';
import { addDays } from './dates';

export const DATABASE_NAME = 'gradatim.db';

export type AiStatus = 'none' | 'pending' | 'done' | 'error' | 'skipped';
export type CategorySource = 'ai' | 'user' | 'guess';

export type Entry = {
  id: number;
  createdAt: string;
  day: string;
  content: string;
  takeaway: string | null;
  category: CategoryKey | null;
  categorySource: CategorySource | null;
  aiReply: string | null;
  aiStatus: AiStatus;
};

export type WeeklyReport = {
  weekStart: string;
  createdAt: string;
  summary: string;
  highlights: string[];
  comparison: string;
  entryCount: number;
  source: 'ai' | 'local';
};

type EntryRow = {
  id: number;
  created_at: string;
  day: string;
  content: string;
  takeaway: string | null;
  category: string | null;
  category_source: string | null;
  ai_reply: string | null;
  ai_status: string;
};

type ReportRow = {
  week_start: string;
  created_at: string;
  summary: string;
  highlights: string;
  comparison: string;
  entry_count: number;
  source: string;
};

export type Attachment = {
  id: number;
  entryId: number;
  /** 附件目录里的文件名（不存完整路径，App 更新后目录位置可能会变） */
  file: string;
  width: number;
  height: number;
  createdAt: string;
};

type AttachmentRow = {
  id: number;
  entry_id: number;
  file: string;
  width: number;
  height: number;
  created_at: string;
};

const SCHEMA_VERSION = 2;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version === null) {
    throw new Error('无法读取数据库版本');
  }
  if (version.user_version > SCHEMA_VERSION) {
    throw new Error('数据库版本比当前 App 新，请更新 App');
  }
  if (version.user_version === SCHEMA_VERSION) {
    return;
  }

  await db.withTransactionAsync(async () => {
    if (version.user_version < 1) {
      await db.execAsync(`
        CREATE TABLE entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at TEXT NOT NULL,
          day TEXT NOT NULL,
          content TEXT NOT NULL,
          takeaway TEXT,
          category TEXT,
          category_source TEXT,
          ai_reply TEXT,
          ai_status TEXT NOT NULL DEFAULT 'none'
        );
        CREATE INDEX idx_entries_day ON entries(day);
        CREATE TABLE weekly_reports (
          week_start TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL,
          summary TEXT NOT NULL,
          highlights TEXT NOT NULL,
          comparison TEXT NOT NULL,
          entry_count INTEGER NOT NULL,
          source TEXT NOT NULL
        );
      `);
    }
    if (version.user_version < 2) {
      await db.execAsync(`
        CREATE TABLE attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
          file TEXT NOT NULL,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_attachments_entry ON attachments(entry_id);
      `);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}

/** 打开数据库时运行：先迁移，再把上次没等到 AI 回应就关掉的记录标成可重试。 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  await migrateDatabase(db);
  await db.runAsync("UPDATE entries SET ai_status = 'error' WHERE ai_status = 'pending'");
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    createdAt: row.created_at,
    day: row.day,
    content: row.content,
    takeaway: row.takeaway,
    category: normalizeCategory(row.category),
    categorySource: (row.category_source as CategorySource | null) ?? null,
    aiReply: row.ai_reply,
    aiStatus: row.ai_status as AiStatus,
  };
}

function toReport(row: ReportRow): WeeklyReport {
  let highlights: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.highlights);
    if (Array.isArray(parsed)) highlights = parsed.filter((h): h is string => typeof h === 'string');
  } catch {
    highlights = [];
  }
  return {
    weekStart: row.week_start,
    createdAt: row.created_at,
    summary: row.summary,
    highlights,
    comparison: row.comparison,
    entryCount: row.entry_count,
    source: row.source === 'ai' ? 'ai' : 'local',
  };
}

// ---------- 记录 ----------

export async function insertEntry(
  db: SQLiteDatabase,
  input: {
    createdAt: string;
    day: string;
    content: string;
    takeaway: string | null;
    category: CategoryKey | null;
    categorySource: CategorySource | null;
    aiStatus: AiStatus;
  },
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO entries (created_at, day, content, takeaway, category, category_source, ai_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.createdAt,
    input.day,
    input.content,
    input.takeaway,
    input.category,
    input.categorySource,
    input.aiStatus,
  );
  return result.lastInsertRowId;
}

export async function getEntry(db: SQLiteDatabase, id: number): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE id = ?', id);
  return row ? toEntry(row) : null;
}

/** 最新的在前。 */
export async function listRecentEntries(db: SQLiteDatabase, limit: number): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM entries ORDER BY created_at DESC, id DESC LIMIT ?',
    limit,
  );
  return rows.map(toEntry);
}

/** 最早的在前。 */
export async function listAllEntries(db: SQLiteDatabase): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>('SELECT * FROM entries ORDER BY created_at ASC, id ASC');
  return rows.map(toEntry);
}

/** 起止日期都包含在内，最早的在前。 */
export async function listEntriesBetween(
  db: SQLiteDatabase,
  startDay: string,
  endDay: string,
): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    'SELECT * FROM entries WHERE day >= ? AND day <= ? ORDER BY created_at ASC, id ASC',
    startDay,
    endDay,
  );
  return rows.map(toEntry);
}

export async function listEntriesForWeek(db: SQLiteDatabase, weekStart: string): Promise<Entry[]> {
  return listEntriesBetween(db, weekStart, addDays(weekStart, 6));
}

export async function updateEntryAi(
  db: SQLiteDatabase,
  id: number,
  update: { aiStatus: AiStatus; aiReply?: string | null; category?: CategoryKey | null; categorySource?: CategorySource },
): Promise<void> {
  if (update.category !== undefined) {
    await db.runAsync(
      'UPDATE entries SET ai_status = ?, ai_reply = ?, category = ?, category_source = ? WHERE id = ?',
      update.aiStatus,
      update.aiReply ?? null,
      update.category,
      update.categorySource ?? 'ai',
      id,
    );
    return;
  }
  if (update.aiReply !== undefined) {
    await db.runAsync('UPDATE entries SET ai_status = ?, ai_reply = ? WHERE id = ?', update.aiStatus, update.aiReply, id);
    return;
  }
  await db.runAsync('UPDATE entries SET ai_status = ? WHERE id = ?', update.aiStatus, id);
}

export async function setEntryCategory(db: SQLiteDatabase, id: number, category: CategoryKey): Promise<void> {
  await db.runAsync("UPDATE entries SET category = ?, category_source = 'user' WHERE id = ?", category, id);
}

export async function deleteEntry(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM entries WHERE id = ?', id);
}

// ---------- 附件 ----------

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    entryId: row.entry_id,
    file: row.file,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

export async function insertAttachment(
  db: SQLiteDatabase,
  attachment: Omit<Attachment, 'id'>,
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO attachments (entry_id, file, width, height, created_at) VALUES (?, ?, ?, ?, ?)',
    attachment.entryId,
    attachment.file,
    attachment.width,
    attachment.height,
    attachment.createdAt,
  );
  return result.lastInsertRowId;
}

export async function listAttachments(db: SQLiteDatabase, entryId: number): Promise<Attachment[]> {
  const rows = await db.getAllAsync<AttachmentRow>('SELECT * FROM attachments WHERE entry_id = ? ORDER BY id', entryId);
  return rows.map(toAttachment);
}

/** 一批记录的附件，按记录分好组。 */
export async function listAttachmentsFor(db: SQLiteDatabase, entryIds: number[]): Promise<Map<number, Attachment[]>> {
  const grouped = new Map<number, Attachment[]>();
  if (entryIds.length === 0) return grouped;
  const placeholders = entryIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<AttachmentRow>(
    `SELECT * FROM attachments WHERE entry_id IN (${placeholders}) ORDER BY id`,
    entryIds,
  );
  for (const row of rows) {
    const list = grouped.get(row.entry_id) ?? [];
    list.push(toAttachment(row));
    grouped.set(row.entry_id, list);
  }
  return grouped;
}

export async function listAllAttachments(db: SQLiteDatabase): Promise<Attachment[]> {
  const rows = await db.getAllAsync<AttachmentRow>('SELECT * FROM attachments ORDER BY id');
  return rows.map(toAttachment);
}

// ---------- 统计 ----------

/** 成长天数：有记录的日子一共多少天，永不清零。 */
export async function countGrowthDays(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(DISTINCT day) AS n FROM entries');
  return row?.n ?? 0;
}

export async function countEntries(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM entries');
  return row?.n ?? 0;
}

export async function getDayCounts(db: SQLiteDatabase, fromDay: string): Promise<Map<string, number>> {
  const rows = await db.getAllAsync<{ day: string; n: number }>(
    'SELECT day, COUNT(*) AS n FROM entries WHERE day >= ? GROUP BY day',
    fromDay,
  );
  return new Map(rows.map((r) => [r.day, r.n]));
}

export async function getCategoryCounts(
  db: SQLiteDatabase,
  fromDay?: string,
): Promise<Partial<Record<CategoryKey, number>>> {
  const rows = fromDay
    ? await db.getAllAsync<{ category: string | null; n: number }>(
        'SELECT category, COUNT(*) AS n FROM entries WHERE day >= ? GROUP BY category',
        fromDay,
      )
    : await db.getAllAsync<{ category: string | null; n: number }>(
        'SELECT category, COUNT(*) AS n FROM entries GROUP BY category',
      );
  const counts: Partial<Record<CategoryKey, number>> = {};
  for (const row of rows) {
    const key = normalizeCategory(row.category);
    if (key) counts[key] = row.n;
  }
  return counts;
}

export async function getFirstEntry(db: SQLiteDatabase): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM entries ORDER BY created_at ASC, id ASC LIMIT 1');
  return row ? toEntry(row) : null;
}

/** 某天之前的最后一条记录，用来在“欢迎回来”时接上话头。 */
export async function getLastEntryBefore(db: SQLiteDatabase, day: string): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>(
    'SELECT * FROM entries WHERE day < ? ORDER BY created_at DESC, id DESC LIMIT 1',
    day,
  );
  return row ? toEntry(row) : null;
}

export async function listDistinctDays(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>('SELECT DISTINCT day FROM entries ORDER BY day DESC');
  return rows.map((r) => r.day);
}

// ---------- 周报 ----------

export async function getWeeklyReport(db: SQLiteDatabase, weekStart: string): Promise<WeeklyReport | null> {
  const row = await db.getFirstAsync<ReportRow>('SELECT * FROM weekly_reports WHERE week_start = ?', weekStart);
  return row ? toReport(row) : null;
}

export async function listWeeklyReports(db: SQLiteDatabase): Promise<WeeklyReport[]> {
  const rows = await db.getAllAsync<ReportRow>('SELECT * FROM weekly_reports ORDER BY week_start DESC');
  return rows.map(toReport);
}

export async function saveWeeklyReport(db: SQLiteDatabase, report: WeeklyReport): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO weekly_reports
       (week_start, created_at, summary, highlights, comparison, entry_count, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    report.weekStart,
    report.createdAt,
    report.summary,
    JSON.stringify(report.highlights),
    report.comparison,
    report.entryCount,
    report.source,
  );
}
