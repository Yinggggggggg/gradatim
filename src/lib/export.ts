/**
 * 把全部记录、周报和主页上的文字导出成一个 JSON 文件，交给系统的分享面板（存到网盘、发给自己都行）。
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { todayString } from './dates';
import { listAllAttachments, listAllEntries, listWeeklyReports } from './db';
import { getProfile } from './profile';

export type ExportResult = 'shared' | 'unavailable';

/** 主页上的文字；头像和背景照片是图片，和记录里的图片一样暂不导出 */
async function exportedProfile() {
  const { nickname, motto, goals } = await getProfile();
  return { nickname, motto, goals };
}

export async function exportEverything(db: SQLiteDatabase): Promise<ExportResult> {
  if (Platform.OS === 'web' || !(await Sharing.isAvailableAsync())) return 'unavailable';

  const payload = {
    app: 'Gradatim',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    entries: await listAllEntries(db),
    weeklyReports: await listWeeklyReports(db),
    // 只导出图片清单；图片文件本身暂时不打进这个文件
    attachments: await listAllAttachments(db),
    profile: await exportedProfile(),
  };
  const file = new File(Paths.cache, `gradatim-${todayString()}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(payload, null, 2));
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: '导出 Gradatim 记录' });
  return 'shared';
}
