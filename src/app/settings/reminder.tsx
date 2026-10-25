import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { InfoButton } from '@/components/info-button';
import { ThemedText } from '@/components/themed-text';
import { Card, Screen, TextButton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/dates';
import { applyReminder } from '@/lib/reminders';
import { getReminderSettings, setReminderSettings, type ReminderSettings } from '@/lib/settings';

const PRESET_TIMES: [number, number][] = [
  [20, 0],
  [21, 0],
  [21, 30],
  [22, 0],
  [22, 30],
];

export default function ReminderScreen() {
  const theme = useTheme();
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getReminderSettings().then(setReminder);
    }, []),
  );

  async function update(next: ReminderSettings) {
    const result = await applyReminder(next);
    const saved = { ...next, enabled: next.enabled && result === 'scheduled', prompted: true };
    await setReminderSettings(saved);
    setReminder(saved);
    if (result === 'denied') setNotice('通知权限没有打开，点 ⓘ 看怎么开。');
    else if (result === 'unsupported') setNotice('网页预览版不能发提醒，请在手机上设置。');
    else if (result === 'scheduled') setNotice(`好，每晚 ${formatTime(saved.hour, saved.minute)} 见。`);
    else setNotice('提醒已关闭。');
  }

  function pickCustomTime() {
    if (!reminder) return;
    const value = new Date();
    value.setHours(reminder.hour, reminder.minute, 0, 0);
    DateTimePickerAndroid.open({
      value,
      mode: 'time',
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          void update({ ...reminder, enabled: true, hour: date.getHours(), minute: date.getMinutes() });
        }
      },
    });
  }

  if (!reminder) return <Screen underHeader>{null}</Screen>;

  return (
    <Screen underHeader>
      <Card>
        <View style={styles.row}>
          <ThemedText type="subtitle" style={styles.flex}>
            {reminder.enabled ? `每晚 ${formatTime(reminder.hour, reminder.minute)}` : '已关闭'}
          </ThemedText>
          <Switch
            value={reminder.enabled}
            onValueChange={(enabled) => update({ ...reminder, enabled })}
            trackColor={{ true: theme.accent, false: theme.border }}
          />
        </View>
        <View style={styles.chips}>
          {PRESET_TIMES.map(([hour, minute]) => {
            const selected = reminder.enabled && reminder.hour === hour && reminder.minute === minute;
            return (
              <Pressable
                key={`${hour}:${minute}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => update({ ...reminder, enabled: true, hour, minute })}
                style={[
                  styles.chip,
                  { borderColor: selected ? theme.accent : theme.border },
                  selected && { backgroundColor: theme.accentSoft },
                ]}>
                <ThemedText type="small" style={{ color: selected ? theme.accent : theme.text }}>
                  {formatTime(hour, minute)}
                </ThemedText>
              </Pressable>
            );
          })}
          {Platform.OS === 'android' ? <TextButton title="其他时间" onPress={pickCustomTime} /> : null}
        </View>
        {notice ? <ThemedText type="caption">{notice}</ThemedText> : null}
      </Card>

      <View style={styles.row}>
        <ThemedText type="caption" style={styles.flex}>
          一句轻轻的问候，没记也不会追问。
        </ThemedText>
        <InfoButton
          title="提醒没响？"
          lines={[
            '国产手机会限制后台运行。',
            '请在系统设置里找到 Gradatim，允许通知和自启动，并把电池设置改成“不限制”或“无限制”。',
          ]}
        />
      </View>
      {Platform.OS !== 'web' ? <TextButton title="打开系统设置" tone="muted" onPress={() => Linking.openSettings()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
