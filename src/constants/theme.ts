/**
 * Gradatim 的配色：暖纸色底、墨色文字、一点圣杯的金色。
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2B2620',
    textSecondary: '#7D7466',
    background: '#F6F1E7',
    card: '#FFFDF8',
    border: '#E7DFD1',
    accent: '#A67B2E',
    accentSoft: '#F2E7CF',
    onAccent: '#FFFFFF',
    danger: '#B4533F',
  },
  dark: {
    text: '#EEE7DA',
    textSecondary: '#A39A8B',
    background: '#16130F',
    card: '#211D18',
    border: '#353029',
    accent: '#D7AE5E',
    accentSoft: '#3A3022',
    onAccent: '#1D1812',
    danger: '#E07A62',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Palette = { [K in ThemeColor]: string };

/** 圣杯舞台（“今天”页顶部、成长页的大数字卡片）用的深色调，明暗两种模式下都一样，好衬出金光 */
export const Hero = {
  background: '#1B1611',
  raised: '#2E261C',
  text: '#F6EAD0',
  textSecondary: '#B9AC95',
  gold: '#F3D27A',
  goldDeep: '#B8872F',
  onGold: '#FFF8E7',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 8,
  medium: 14,
  large: 20,
  hero: 32,
} as const;

export const MaxContentWidth = 640;
