/**
 * 成长地图的六个方向。AI 会自动归类；没有 AI 时，先用关键词猜一个，用户随时可以改。
 */

export const CATEGORY_KEYS = ['body', 'knowledge', 'skill', 'creation', 'relation', 'mind'] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORIES: Record<CategoryKey, { label: string; color: string; hint: string }> = {
  body: { label: '身体', color: '#5E9A6A', hint: '运动、睡眠、饮食、健康' },
  knowledge: { label: '知识', color: '#5A84B0', hint: '读书、学习、课程、新知' },
  skill: { label: '技能', color: '#C08A3E', hint: '练一门手艺或本事' },
  creation: { label: '创作', color: '#B0688F', hint: '写、画、亲手做出一样东西' },
  relation: { label: '关系', color: '#C9725C', hint: '家人、朋友、和人相处' },
  mind: { label: '内心', color: '#8378B5', hint: '情绪、反思、平静与勇气' },
};

const KEYWORDS: Record<CategoryKey, string[]> = {
  body: ['跑步', '跑了', '健身', '运动', '锻炼', '游泳', '骑行', '瑜伽', '睡', '早起', '拉伸', '散步', '爬山', '饮食', '喝水', '体重', '俯卧撑', '深蹲', '打球', '徒步'],
  knowledge: ['读', '书', '学', '课', '知识', '论文', '播客', '纪录片', '英语', '单词', '历史', '研究'],
  skill: ['练', '技能', '编程', '代码', '弹', '琴', '吉他', '做饭', '做菜', '开车', '摄影', '书法', '剪辑', '口语'],
  creation: ['写', '画', '创作', '手工', '作品', '设计', '拼豆', '钩织', '做了一个', '拍了', '搭了'],
  relation: ['家人', '妈', '爸', '父母', '孩子', '娃', '朋友', '陪', '聊天', '打电话', '同事', '伴侣', '老婆', '老公', '对象', '帮'],
  mind: ['情绪', '冥想', '反思', '复盘', '心情', '焦虑', '平静', '耐心', '原谅', '勇气', '发火', '生气', '感恩', '日记', '放下', '接纳'],
};

export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === 'string' && (CATEGORY_KEYS as readonly string[]).includes(value);
}

/** 接受 key（body）或中文名（身体），其他情况返回 null。 */
export function normalizeCategory(value: unknown): CategoryKey | null {
  if (isCategoryKey(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return CATEGORY_KEYS.find((key) => CATEGORIES[key].label === trimmed) ?? null;
}

/** 按关键词出现次数猜方向，猜不出来就返回 null。 */
export function guessCategory(text: string): CategoryKey | null {
  let best: CategoryKey | null = null;
  let bestScore = 0;
  for (const key of CATEGORY_KEYS) {
    const score = KEYWORDS[key].reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
    if (score > bestScore) {
      best = key;
      bestScore = score;
    }
  }
  return best;
}
