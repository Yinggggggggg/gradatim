import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="reminder" options={{ title: '每晚提醒' }} />
      <Stack.Screen name="account" options={{ title: '账号' }} />
      <Stack.Screen name="ai" options={{ title: 'AI' }} />
      <Stack.Screen name="data" options={{ title: '数据' }} />
      <Stack.Screen name="about" options={{ title: '关于 Gradatim' }} />
    </Stack>
  );
}
