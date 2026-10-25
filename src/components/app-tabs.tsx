import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.card}
      indicatorColor={theme.accentSoft}
      tintColor={theme.accent}
      iconColor={{ default: theme.textSecondary, selected: theme.accent }}
      labelStyle={{ default: { color: theme.textSecondary }, selected: { color: theme.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>今天</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="auto_awesome" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="growth">
        <NativeTabs.Trigger.Label>成长</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="leaf" md="eco" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="board">
        <NativeTabs.Trigger.Label>排行</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy" md="leaderboard" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
