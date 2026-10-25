import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

/** 从底部弹出的选项面板。安卓自带的对话框最多只能放三个按钮，所以自己做一个。 */
export function Sheet({
  visible,
  title,
  message,
  actions,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  actions?: SheetAction[];
  onClose: () => void;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* 面板里有输入框时，弹出的键盘不能把它挡住 */}
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭">
          <Pressable style={[styles.panel, { backgroundColor: theme.card }]} onPress={() => {}}>
            {title ? <ThemedText type="subtitle">{title}</ThemedText> : null}
            {message ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                {message}
              </ThemedText>
            ) : null}
            {children}
            {actions?.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
                style={({ pressed }) => [styles.action, { borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText style={{ color: action.destructive ? theme.danger : theme.text }}>{action.label}</ThemedText>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.action, { borderColor: theme.border }, pressed && styles.pressed]}>
              <ThemedText themeColor="textSecondary">取消</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.two,
  },
  action: {
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
});
