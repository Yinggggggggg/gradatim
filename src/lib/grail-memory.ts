/**
 * 记住圣杯动画已经为哪一天播过，免得同一天的光点落两次。
 */

import Storage from 'expo-sqlite/kv-store';

const KEY = 'grail.celebratedDays';

export async function getCelebratedDays(): Promise<number | null> {
  const raw = await Storage.getItem(KEY);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

export async function setCelebratedDays(days: number): Promise<void> {
  await Storage.setItem(KEY, String(days));
}
