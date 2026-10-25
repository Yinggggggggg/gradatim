import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 圆形头像；没有图片时显示昵称的第一个字。 */
export function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const theme = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[shape, { backgroundColor: theme.accentSoft }]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }

  const initial = Array.from(name.trim())[0] ?? 'G';
  return (
    <View style={[shape, styles.fallback, { backgroundColor: theme.accentSoft }]}>
      <ThemedText
        style={{ color: theme.accent, fontFamily: Fonts.serif, fontSize: size * 0.42, lineHeight: size * 0.56 }}>
        {initial}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
