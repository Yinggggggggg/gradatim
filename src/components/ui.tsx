import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// 网页预览时标签栏浮在底部，要给内容留出位置
export const WEB_TAB_BAR_SPACE = Platform.OS === 'web' ? 72 : 0;

/** 可以滚动的页面。有原生标题栏的二级页面传 underHeader，顶部不再留出状态栏的高度。 */
export function Screen({ children, underHeader = false }: { children: ReactNode; underHeader?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[
        styles.screenContent,
        {
          paddingTop: (underHeader ? 0 : insets.top) + Spacing.four,
          paddingBottom: Spacing.six + WEB_TAB_BAR_SPACE,
        },
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={styles.screenInner}>{children}</View>
    </ScrollView>
  );
}

export function Card({
  children,
  tone = 'default',
  style,
}: {
  children: ReactNode;
  tone?: 'default' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        tone === 'soft'
          ? { backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }
          : { backgroundColor: theme.card, borderColor: theme.border },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? theme.accent : theme.accentSoft },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.onAccent : theme.accent} />
      ) : (
        <ThemedText type="smallBold" style={{ color: primary ? theme.onAccent : theme.accent }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function TextButton({
  title,
  onPress,
  tone = 'accent',
  disabled,
}: {
  title: string;
  onPress: () => void;
  tone?: 'accent' | 'muted' | 'danger';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : tone === 'muted' ? theme.textSecondary : theme.accent;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [disabled && styles.disabled, pressed && styles.pressed]}>
      <ThemedText type="smallBold" style={{ color }}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <ThemedText type="subtitle">{title}</ThemedText>
      {hint ? <ThemedText type="caption">{hint}</ThemedText> : null}
    </View>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.accentSoft }]}>
      <ThemedText type="smallBold" style={{ color: theme.accent }}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  screenInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  button: {
    minHeight: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
  sectionTitle: {
    gap: Spacing.half,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
