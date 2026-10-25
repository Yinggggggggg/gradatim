/**
 * 每晚提醒：一周七条本地通知，周日那条顺便告诉你周报好了。
 * 提醒的话永远是同一句轻轻的问候，从不提“中断”。
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ReminderSettings } from './settings';

const CHANNEL_ID = 'evening-reminder';
const SUNDAY = 1; // expo-notifications 里 1 表示周日

const EVENING_TEXT = '今天有什么让你变好的事吗？';
const SUNDAY_TEXT = '这周的你已经可以看了。顺手记下今天的一件事？';

export type ReminderResult = 'scheduled' | 'off' | 'denied' | 'unsupported';

export function configureNotifications(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '每晚提醒',
    // eslint-disable-next-line import/namespace -- 这个枚举经由 export * 导出，lint 规则跟不过去，类型检查能确认它存在
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function ensurePermission(askIfNeeded: boolean): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!askIfNeeded || !current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function schedule(settings: ReminderSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (let weekday = 1; weekday <= 7; weekday++) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Gradatim', body: weekday === SUNDAY ? SUNDAY_TEXT : EVENING_TEXT },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour: settings.hour,
        minute: settings.minute,
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** 按设置打开或关闭提醒；需要时会弹出系统的通知权限请求。 */
export async function applyReminder(settings: ReminderSettings): Promise<ReminderResult> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!settings.enabled) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return 'off';
  }
  if (!(await ensurePermission(true))) return 'denied';
  await schedule(settings);
  return 'scheduled';
}

/** 启动时重新排一遍，防止系统清掉了已排好的提醒。不会弹权限请求。 */
export async function syncReminderOnLaunch(settings: ReminderSettings): Promise<void> {
  if (Platform.OS === 'web' || !settings.enabled) return;
  if (await ensurePermission(false)) await schedule(settings);
}
