import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { InfoIcon } from '@/components/icons';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** 一个小小的 ⓘ：页面上只留一行字，详细说明点开才看。 */
export function InfoButton({
  title,
  lines,
  color,
  size = 18,
}: {
  title: string;
  lines: string[];
  color?: string;
  size?: number;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}：说明`}
        onPress={() => setOpen(true)}
        hitSlop={12}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <InfoIcon size={size} color={color ?? theme.textSecondary} strokeWidth={2} />
      </Pressable>
      <Sheet visible={open} title={title} onClose={() => setOpen(false)}>
        {lines.map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            {line}
          </ThemedText>
        ))}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
