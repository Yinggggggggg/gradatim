import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORIES, CATEGORY_KEYS, type CategoryKey } from '@/lib/categories';

export function CategoryChip({ category, onPress }: { category: CategoryKey | null; onPress?: () => void }) {
  const theme = useTheme();
  const color = category ? CATEGORIES[category].color : theme.textSecondary;
  const label = category ? CATEGORIES[category].label : '未分类';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`方向：${label}，点按修改`}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      style={[styles.chip, { backgroundColor: `${color}22` }]}>
      <ThemedText type="caption" style={[styles.chipText, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function CategoryPicker({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: CategoryKey | null;
  onSelect: (category: CategoryKey) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  return (
    <Sheet visible={visible} title="这件事属于哪个方向？" onClose={onClose}>
      {CATEGORY_KEYS.map((key) => {
        const { label, hint, color } = CATEGORIES[key];
        const selected = key === current;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              onClose();
              onSelect(key);
            }}
            style={({ pressed }) => [
              styles.option,
              { borderColor: theme.border },
              selected && { backgroundColor: `${color}18` },
              pressed && styles.pressed,
            ]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <View style={styles.optionText}>
              <ThemedText type="smallBold">{label}</ThemedText>
              <ThemedText type="caption">{hint}</ThemedText>
            </View>
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  chipText: {
    fontWeight: 600,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pressed: {
    opacity: 0.6,
  },
});
