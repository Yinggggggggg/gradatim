/** 圣杯进度：每个成长日往杯里添一点金色，满一杯要多少个成长日。 */
export const CUP_DAYS = 100;

/**
 * 第 1 到 100 天在第一杯里，第 100 天正好装满；第 101 天开始倒第二杯。
 * fullCups 是已经装满、放到一边的杯数；current 是正在装的这一杯里有几天。
 */
export function grailProgress(days: number): { fullCups: number; current: number } {
  if (days <= 0) return { fullCups: 0, current: 0 };
  const fullCups = Math.floor((days - 1) / CUP_DAYS);
  return { fullCups, current: days - fullCups * CUP_DAYS };
}
