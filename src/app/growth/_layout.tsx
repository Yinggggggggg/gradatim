import { Stack } from 'expo-router';

import { useStackOptions } from '@/hooks/use-stack-options';

export default function GrowthLayout() {
  return (
    <Stack screenOptions={useStackOptions()}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="weekly" options={{ title: '往期周报' }} />
    </Stack>
  );
}
