import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DATABASE_NAME, initializeDatabase } from '@/lib/db';
import { configureNotifications, syncReminderOnLaunch } from '@/lib/reminders';
import { getReminderSettings } from '@/lib/settings';

SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const palette = Colors[scheme];
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.card,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
        <OnReady />
        <AppTabs />
      </SQLiteProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

/** 数据库准备好之后才会渲染到这里：收起启动画面，并补排一次每晚提醒。 */
function OnReady() {
  useEffect(() => {
    SplashScreen.hideAsync();
    getReminderSettings()
      .then(syncReminderOnLaunch)
      .catch(() => {
        // 补排失败不影响使用，下次启动或在“我的”里改动时会再排
      });
  }, []);
  return null;
}
