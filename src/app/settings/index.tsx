import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { type ComponentType, useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { BellIcon, ChevronRightIcon, CupIcon, DownloadIcon, SparkleIcon, UserIcon } from '@/components/icons';
import { PressableScale } from '@/components/pressable-scale';
import { ProfileSection } from '@/components/profile-section';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useCloudUser } from '@/hooks/use-cloud-user';
import { useTheme } from '@/hooks/use-theme';
import { PROVIDERS } from '@/lib/ai/providers';
import { isCloudConfigured } from '@/lib/cloud';
import { formatTime } from '@/lib/dates';
import { getAiSettings, getReminderSettings, type ReminderSettings } from '@/lib/settings';

type Row = {
  href: Href;
  label: string;
  value: string;
  Icon: ComponentType<{ size?: number; color: string; strokeWidth?: number }>;
  tint: string;
  color: string;
};

/** “我的”：上面是自己的主页，下面每项设置一行，点进去再看细节。 */
export default function MeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useCloudUser();
  const [reminder, setReminder] = useState<ReminderSettings | null>(null);
  const [aiLabel, setAiLabel] = useState('');

  useFocusEffect(
    useCallback(() => {
      void getReminderSettings().then(setReminder);
      void getAiSettings().then((settings) => setAiLabel(PROVIDERS[settings.provider].label));
    }, []),
  );

  const rows: Row[] = [
    {
      href: '/settings/reminder',
      label: '每晚提醒',
      value: reminder ? (reminder.enabled ? formatTime(reminder.hour, reminder.minute) : '已关闭') : '',
      Icon: BellIcon,
      tint: '#F6E6CF',
      color: '#A8701F',
    },
    ...(isCloudConfigured()
      ? [
          {
            href: '/settings/account' as Href,
            label: '账号',
            value: user ? '已登录' : '未登录',
            Icon: UserIcon,
            tint: '#DFE8F3',
            color: '#3F6A99',
          },
        ]
      : []),
    { href: '/settings/ai', label: 'AI', value: aiLabel, Icon: SparkleIcon, tint: '#E8E2F3', color: '#6A5A9E' },
    { href: '/settings/data', label: '数据', value: '导出', Icon: DownloadIcon, tint: '#E4EEDC', color: '#4F7A36' },
    { href: '/settings/about', label: '关于 Gradatim', value: '', Icon: CupIcon, tint: theme.accentSoft, color: theme.accent },
  ];

  return (
    <Screen>
      <ProfileSection />
      <Animated.View
        entering={FadeInDown.delay(120).springify().damping(18)}
        style={[styles.list, { backgroundColor: theme.card, borderColor: theme.border }]}>
        {rows.map((row, index) => (
          <PressableScale
            key={row.label}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${row.label}${row.value ? `，${row.value}` : ''}`}
            onPress={() => router.push(row.href)}
            style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <View style={[styles.icon, { backgroundColor: row.tint }]}>
              <row.Icon size={18} color={row.color} strokeWidth={1.9} />
            </View>
            <ThemedText style={styles.label}>{row.label}</ThemedText>
            {row.value ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.value}>
                {row.value}
              </ThemedText>
            ) : null}
            <ChevronRightIcon size={16} color={theme.textSecondary} strokeWidth={2} />
          </PressableScale>
        ))}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 54,
    paddingHorizontal: Spacing.three,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  value: {
    maxWidth: 160,
  },
});
