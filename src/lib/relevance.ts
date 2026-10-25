/**
 * 从旧记录里找出和新记录相关的几条，好让 AI 做“以前 vs 现在”的对比。
 * 中文不分词：用单字加相邻两字一起比较重合度。记录都很短，单字最能抓住
 * “练了 30 分钟字”和“练字 20 分钟”这种语序不同的相似。
 */

import type { Entry } from './db';

const STOP_CHARS = new Set(
  Array.from('的了是我在有和就不也都很个这那你他她它们着过吗呢吧啊今天分钟小时次点些得地上下会能要去来到说看想做还没把被给让对从与及或而但如果因为所以然后已经终于觉感自一时候昨明早晚'),
);

const MIN_SCORE = 0.2;

export function textOf(entry: Pick<Entry, 'content' | 'takeaway'>): string {
  return entry.takeaway ? `${entry.content} ${entry.takeaway}` : entry.content;
}

export function features(text: string): Set<string> {
  const result = new Set<string>();
  const normalized = text.toLowerCase();
  for (const word of normalized.match(/[a-z0-9]+/g) ?? []) {
    if (word.length > 1 && !/^\d+$/.test(word)) result.add(word);
  }
  for (const run of normalized.split(/[^一-鿿]+/)) {
    for (let i = 0; i < run.length; i++) {
      const char = run[i];
      if (!STOP_CHARS.has(char)) result.add(char);
      const next = run[i + 1];
      if (next && !(STOP_CHARS.has(char) && STOP_CHARS.has(next))) result.add(char + next);
    }
  }
  return result;
}

/** Dice 系数：0 表示毫无重合，1 表示完全一样。 */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const item of a) if (b.has(item)) shared++;
  return (2 * shared) / (a.size + b.size);
}

function byTime(x: Entry, y: Entry): number {
  return x.createdAt.localeCompare(y.createdAt);
}

/**
 * 挑出最多 limit 条相关记录，按时间从早到晚排列。最早的那条一定在里面，
 * 方便说出“第一次你写的是……”。total 是所有相关旧记录的条数。
 * 相关度取两种比法里高的那个：只比“做了什么”，或者连同收获一起比。
 * 同一件事每次的收获写法都不一样，只比整句会把它漏掉。
 */
export function selectRelated(
  target: Pick<Entry, 'content' | 'takeaway'>,
  candidates: Entry[],
  limit: number,
): { entries: Entry[]; total: number } {
  const targetContent = features(target.content);
  const targetText = features(textOf(target));
  const related = candidates
    .map((entry) => ({
      entry,
      score: Math.max(
        similarity(targetContent, features(entry.content)),
        similarity(targetText, features(textOf(entry))),
      ),
    }))
    .filter((item) => item.score >= MIN_SCORE);
  if (related.length === 0 || limit <= 0) return { entries: [], total: related.length };

  const picked = [...related]
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((item) => item.entry);
  const earliest = related.map((item) => item.entry).sort(byTime)[0];
  if (!picked.includes(earliest)) picked[picked.length - 1] = earliest;

  return { entries: picked.sort(byTime), total: related.length };
}
