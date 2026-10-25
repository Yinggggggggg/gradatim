import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 网页预览用的底部标签栏，手机上用的是系统原生标签栏。 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <BottomBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>今天</TabButton>
          </TabTrigger>
          <TabTrigger name="growth" href="/growth" asChild>
            <TabButton>成长</TabButton>
          </TabTrigger>
          <TabTrigger name="board" href="/board" asChild>
            <TabButton>排行</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton>我的</TabButton>
          </TabTrigger>
        </BottomBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <View style={[styles.buttonInner, isFocused && { backgroundColor: theme.accentSoft }]}>
        <ThemedText type="smallBold" style={{ color: isFocused ? theme.accent : theme.textSecondary }}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function BottomBar(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={styles.container}>
      <View style={[styles.bar, { backgroundColor: theme.card, borderColor: theme.border }]}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.two,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.one,
  },
  button: {
    flex: 1,
  },
  buttonInner: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.medium,
  },
  pressed: {
    opacity: 0.7,
  },
});
