/**
 * 触感反馈。安卓用系统自带的触感效果（比振动马达模拟的更细腻），网页上不振动。
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** 轻点按钮、选项时 */
export function tapHaptic(): void {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click).catch(() => undefined);
  } else if (Platform.OS === 'ios') {
    Haptics.selectionAsync().catch(() => undefined);
  }
}

/** 记下一件事、光点落进圣杯时 */
export function successHaptic(): void {
  if (Platform.OS === 'android') {
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
  } else if (Platform.OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }
}
