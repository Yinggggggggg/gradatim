import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'small' | 'smallBold' | 'caption' | 'subtitle' | 'title' | 'display';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const defaultColor: ThemeColor = type === 'caption' ? 'textSecondary' : 'text';

  return <Text style={[{ color: theme[themeColor ?? defaultColor] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: 600,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: 600,
  },
  display: {
    fontFamily: Fonts.serif,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: 600,
  },
});
