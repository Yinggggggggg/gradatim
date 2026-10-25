/**
 * 日期工具。所有“某一天”都用本地时间的 YYYY-MM-DD 字符串表示，一周从周一开始。
 */

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 周报在每周日的这个时刻之后可以生成。 */
export const WEEKLY_REPORT_HOUR = 18;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function toDayString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayString(now: Date = new Date()): string {
  return toDayString(now);
}

export function addDays(day: string, n: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + n);
  return toDayString(date);
}

/** b 比 a 晚多少天（按日历日计算，不受时区和夏令时影响）。 */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** 这一天所在那周的周一。 */
export function weekStartOf(day: string): string {
  const date = parseDay(day);
  const sinceMonday = (date.getDay() + 6) % 7;
  return addDays(day, -sinceMonday);
}

export function weekdayLabel(day: string): string {
  return WEEKDAY_LABELS[parseDay(day).getDay()];
}

function monthDay(day: string): string {
  const date = parseDay(day);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

/** 列表里的日期标题：今天、昨天、10月22日 周三、2025年10月22日。 */
export function formatDayLabel(day: string, today: string = todayString()): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return '今天';
  if (diff === 1) return '昨天';
  if (day.slice(0, 4) !== today.slice(0, 4)) {
    return `${day.slice(0, 4)}年${monthDay(day)}`;
  }
  return `${monthDay(day)} ${weekdayLabel(day)}`;
}

export function formatFullDate(day: string): string {
  return `${day.slice(0, 4)}年${monthDay(day)}`;
}

export function formatWeekRange(weekStart: string): string {
  return `${monthDay(weekStart)} – ${monthDay(addDays(weekStart, 6))}`;
}

/** 这一周的周报是否已经可以生成：周日晚上 6 点之后，或者这周已经过去。 */
export function isWeekReportReady(weekStart: string, now: Date = new Date()): boolean {
  const sundayEvening = parseDay(addDays(weekStart, 6));
  sundayEvening.setHours(WEEKLY_REPORT_HOUR, 0, 0, 0);
  return now.getTime() >= sundayEvening.getTime();
}

export function formatTime(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}
