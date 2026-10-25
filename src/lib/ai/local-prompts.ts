/**
 * 给手机本地小模型的提示词。小模型处理长提示很慢，也容易编造，
 * 所以证据由代码先算好（第一次、上一次、有几条同类记录），模型只负责分类和把证据说成一句话。
 */

import { CATEGORIES, CATEGORY_KEYS } from '../categories';
import { daysBetween, formatFullDate, formatWeekRange } from '../dates';
import type { Entry } from '../db';
import { features, similarity } from '../relevance';
import type { ReflectionInput, WeeklyInput } from './types';

/** 比挑选相关记录时更严格：小模型不会自己判断是不是同一件事。 */
const SAME_THING_SCORE = 0.3;
const MAX_TEXT = 40;
const MAX_WEEK_ENTRIES = 14;

export const LOCAL_REFLECTION_SYSTEM = `你是“见证者”。根据材料写一两句中文（不超过 60 字），说出这次和以前比有什么变化。
规则：只说材料里有的事实；不夸奖，不说教，不用感叹号；用“你”称呼对方；没有旧记录时，就点出这次具体做了什么。
同时给这件事选一个方向：body（身体）、knowledge（知识）、skill（技能）、creation（创作）、relation（关系）、mind（内心）。`;

export const LOCAL_WEEKLY_SYSTEM = `你是“见证者”。根据这周的记录写“这周的你”。
summary：两三句话，说这周在哪些方向做了什么。
highlights：最多三条最值得记住的事，每条不超过 30 字，尽量用原话。
comparison：一两句以前和现在的对比；没有以前的记录，就说这是开始的一周。
只说材料里的事实；不夸奖，不说教，不用感叹号；用“你”称呼对方。`;

// 输出结构交给 llama.cpp 的语法约束，小模型也不会把格式写错
export const LOCAL_REFLECTION_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...CATEGORY_KEYS] },
    reply: { type: 'string', maxLength: 80 },
  },
  required: ['category', 'reply'],
  additionalProperties: false,
};

export const LOCAL_WEEKLY_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', maxLength: 160 },
    highlights: { type: 'array', items: { type: 'string', maxLength: 40 }, maxItems: 3 },
    comparison: { type: 'string', maxLength: 100 },
  },
  required: ['summary', 'highlights', 'comparison'],
  additionalProperties: false,
};

function short(text: string): string {
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
}

function describe(entry: Entry): string {
  return entry.takeaway ? `${short(entry.content)}。收获：${short(entry.takeaway)}` : short(entry.content);
}

export function localReflectionPrompt(input: ReflectionInput): string {
  const { entry } = input;
  // 只比较“做了什么”：收获每次写法都不一样，混进来会把同一件事判成不相关
  const target = features(entry.content);
  const same = input.related.filter((other) => similarity(target, features(other.content)) >= SAME_THING_SCORE);
  const lines = [`这次（${formatFullDate(entry.day)}）：${describe(entry)}`];

  if (same.length === 0) {
    // 只写“没有”的话，小模型常常还是编一句“比以前更……”
    lines.push('同类的旧记录：没有。这是第一次记这类事，不要和以前比较，只说这次具体做了什么。');
    return lines.join('\n');
  }
  const truncated = input.relatedTotal > input.related.length;
  lines.push(`同类的旧记录：${truncated ? `至少 ${same.length}` : same.length} 条。`);
  const first = same[0];
  lines.push(`第一次（${formatFullDate(first.day)}，${daysBetween(first.day, entry.day)} 天前）：${describe(first)}`);
  const last = same[same.length - 1];
  if (last !== first) lines.push(`上一次（${formatFullDate(last.day)}）：${describe(last)}`);
  return lines.join('\n');
}

export function localWeeklyPrompt(input: WeeklyInput): string {
  const lines = [`这周：${formatWeekRange(input.weekStart)}，共 ${input.weekEntries.length} 条记录。`];
  for (const entry of input.weekEntries.slice(-MAX_WEEK_ENTRIES)) {
    const category = entry.category ? CATEGORIES[entry.category].label : '未分类';
    lines.push(`- ${formatFullDate(entry.day)}｜${category}｜${describe(entry)}`);
  }
  const earlier = input.earlier.slice(0, 3);
  if (earlier.length > 0) {
    lines.push('以前的相关记录：');
    for (const entry of earlier) lines.push(`- ${formatFullDate(entry.day)}｜${describe(entry)}`);
  } else {
    lines.push('以前的相关记录：没有。');
  }
  return lines.join('\n');
}
