/**
 * 给 AI 的提示词。所有服务商共用同一套规则，保证换了模型说话方式不变。
 */

import { z } from 'zod';

import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from '../categories';
import { formatFullDate, formatWeekRange } from '../dates';
import type { Entry } from '../db';
import type { ReflectionInput, WeeklyInput } from './types';

export const ReflectionSchema = z.object({
  category: z.enum(CATEGORY_KEYS),
  reply: z.string(),
});

export const WeeklySchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()),
  comparison: z.string(),
});

export const REFLECTION_SYSTEM = `你是 Gradatim 里的“见证者”。用户每天记下一件让自己变好的事，有时附一句收获。你的任务是让用户看见自己的变化。

输出两个字段：
- category：从 body（身体）、knowledge（知识）、skill（技能）、creation（创作）、relation（关系）、mind（内心）里选最贴切的一个。
- reply：写给用户看的一到两句中文，不超过 60 个字。

写 reply 的规则：
- 只说事实。不夸奖，不鼓励，不说教，不用感叹号，不写“你真棒”“继续加油”这类话。
- 能对比就对比：从相关的旧记录里找出同一件事，用具体的次数、时间跨度、当时的原话和这次的说法做对比。例如：“第 5 次练字了。第一次你写的是‘歪得不敢看’，今天横已经平了。”
- 只有确定旧记录和这次是同一件事时，才说“第几次”；拿不准就不提次数。
- 没有可对比的旧记录时，点出这次记录里具体的地方；如果明显是第一次做这件事，就说是第一次。
- 不提用户中断了多久、几天没记录。
- 用“你”称呼用户。`;

export const WEEKLY_SYSTEM = `你是 Gradatim 里的“见证者”。每周日，你给用户写一份“这周的你”，让用户看见这一周自己的变化。

输出三个字段：
- summary：两三句话，说清这周用户在哪些方向上做了什么、有什么变化，具体到事情本身。
- highlights：这周最值得记住的事，最多三条，每条不超过 30 个字，尽量用用户自己的说法。
- comparison：一两句“以前 vs 现在”的对比，用以前的相关记录对照这周的记录。没有以前的记录时，就对比这周的头一天和最后一天；如果这是用户开始记录的第一周，就直说这是开始的一周。

规则：
- 只说事实。不夸奖，不鼓励，不说教，不用感叹号。
- 不提中断、漏记或记录得少。
- 用“你”称呼用户。`;

// Claude 用结构化输出保证格式；兼容 OpenAI 接口的服务只能靠提示词说明格式
export const REFLECTION_JSON_SHAPE = `只输出一个 JSON 对象，不要输出别的文字，格式如下：
{"category": "body、knowledge、skill、creation、relation、mind 中的一个", "reply": "写给用户看的一到两句话"}`;

export const WEEKLY_JSON_SHAPE = `只输出一个 JSON 对象，不要输出别的文字，格式如下：
{"summary": "两三句话", "highlights": ["第一件事", "第二件事"], "comparison": "一两句以前和现在的对比"}`;

function describeEntry(entry: Entry): string {
  const category = entry.category ? CATEGORIES[entry.category].label : '未分类';
  const takeaway = entry.takeaway ? `｜收获：${entry.takeaway}` : '';
  return `- ${formatFullDate(entry.day)}｜${category}｜${entry.content}${takeaway}`;
}

export function reflectionPrompt(input: ReflectionInput): string {
  const { entry, related, relatedTotal } = input;
  const relatedHeader =
    relatedTotal > related.length
      ? `相关的旧记录共 ${relatedTotal} 条，下面列出其中 ${related.length} 条，从早到晚`
      : `相关的旧记录共 ${relatedTotal} 条，从早到晚`;
  return [
    `今天是${formatFullDate(input.today)}。`,
    '',
    '【这次的记录】',
    `日期：${formatFullDate(entry.day)}`,
    `做了什么：${entry.content}`,
    `收获：${entry.takeaway ?? '（没写）'}`,
    '',
    `【${relatedHeader}】`,
    related.length > 0 ? related.map(describeEntry).join('\n') : '暂无',
    '',
    '“相关”是按文字相似挑出来的，不一定都是同一件事，请自己判断。',
    `这是用户的第 ${input.entryNumber} 条记录，有记录的日子累计 ${input.growthDays} 天。`,
  ].join('\n');
}

export function weeklyPrompt(input: WeeklyInput): string {
  const counts = new Map<CategoryKey, number>();
  for (const entry of input.weekEntries) {
    if (entry.category) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  }
  const countText = CATEGORY_KEYS.filter((key) => counts.has(key))
    .map((key) => `${CATEGORIES[key].label} ${counts.get(key)}`)
    .join('、');
  return [
    `这周是${formatWeekRange(input.weekStart)}。`,
    '',
    `【这周的记录，共 ${input.weekEntries.length} 条，从早到晚】`,
    input.weekEntries.map(describeEntry).join('\n'),
    '',
    '【这周以前的相关记录，从早到晚】',
    input.earlier.length > 0 ? input.earlier.map(describeEntry).join('\n') : '暂无',
    '',
    `这周各方向的条数：${countText || '暂无分类'}。用户有记录的日子累计 ${input.growthDays} 天。`,
  ].join('\n');
}
