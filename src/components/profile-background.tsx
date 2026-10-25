import { Image } from 'expo-image';
import { useId } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { type BackgroundPreset, type ProfileBackground } from '@/lib/profile';
import { profileImageUri } from '@/lib/profile-images';

export const PRESET_LABELS: Record<BackgroundPreset, string> = {
  dawn: '晨光',
  parchment: '羊皮纸',
  night: '夜空',
  forest: '林间',
  sea: '海',
  dusk: '暮色',
};

/** 每套预设的上下两种底色 */
const GRADIENTS: Record<BackgroundPreset, [string, string]> = {
  dawn: ['#FFF6DE', '#F0CF7E'],
  parchment: ['#F7F0E0', '#E3D1AC'],
  night: ['#151A30', '#3A416C'],
  forest: ['#EEF3E6', '#BFD6B0'],
  sea: ['#EAF4F7', '#9FC9DC'],
  dusk: ['#FBE3D0', '#D6968C'],
};

/** 夜空里星星的位置和大小，固定下来每次都一样 */
const STARS = [
  [24, 18, 1.2], [62, 44, 0.8], [96, 22, 1.5], [132, 58, 0.9], [168, 16, 1.1], [205, 40, 0.7],
  [238, 24, 1.4], [272, 62, 0.9], [300, 14, 1], [356, 70, 0.8], [384, 26, 1.3], [44, 84, 0.9],
  [118, 96, 1.1], [190, 82, 0.8], [252, 100, 1.2], [318, 92, 0.9], [372, 110, 1], [86, 128, 0.7],
] as const;

/** 预设背景的图案。viewBox 是 400 × 160，按 slice 铺满，宽窄屏都不会露边。 */
function PresetArt({ preset }: { preset: BackgroundPreset }) {
  // 网页上 SVG 的 id 是全局的，每个实例要有自己的 id
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const [top, bottom] = GRADIENTS[preset];

  return (
    <Svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
        <RadialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="160" fill={`url(#${id}-sky)`} />

      {preset === 'dawn' ? (
        <G>
          {Array.from({ length: 9 }, (_, i) => {
            const angle = Math.PI + (i + 1) * (Math.PI / 10);
            const x = 200 + Math.cos(angle) * 260;
            const y = 170 + Math.sin(angle) * 260;
            return <Path key={i} d={`M200 170 L${x - 6} ${y} L${x + 6} ${y} Z`} fill="#FFFFFF" opacity={0.18} />;
          })}
          <Circle cx="200" cy="170" r="120" fill={`url(#${id}-glow)`} />
          <Circle cx="200" cy="170" r="34" fill="#FFF3C9" opacity={0.9} />
        </G>
      ) : null}

      {preset === 'parchment' ? (
        <G stroke="#B89E6E" strokeWidth={0.6} opacity={0.22}>
          {[22, 47, 70, 96, 121, 143].map((y, i) => (
            <Path key={y} d={`M0 ${y} C100 ${y + (i % 2 ? 4 : -4)} 300 ${y + (i % 2 ? -4 : 4)} 400 ${y}`} fill="none" />
          ))}
        </G>
      ) : null}

      {preset === 'night' ? (
        <G>
          {STARS.map(([x, y, r]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.55 + r * 0.25} />
          ))}
          <Circle cx="330" cy="44" r="30" fill="#F5E9C4" opacity={0.12} />
          <Circle cx="330" cy="44" r="14" fill="#F5E9C4" />
          <Circle cx="336" cy="40" r="12" fill="#1C2240" />
        </G>
      ) : null}

      {preset === 'forest' ? (
        <G>
          <Path d="M0 112 C70 84 130 100 200 92 C270 84 330 70 400 90 L400 160 L0 160 Z" fill="#A6C496" />
          <Path d="M0 132 C80 110 150 128 230 118 C300 110 350 116 400 108 L400 160 L0 160 Z" fill="#86AD78" />
        </G>
      ) : null}

      {preset === 'sea' ? (
        <G fill="none" stroke="#FFFFFF" strokeWidth={2}>
          <Path d="M0 104 C40 96 60 112 100 104 C140 96 160 112 200 104 C240 96 260 112 300 104 C340 96 360 112 400 104" opacity={0.55} />
          <Path d="M0 124 C40 116 60 132 100 124 C140 116 160 132 200 124 C240 116 260 132 300 124 C340 116 360 132 400 124" opacity={0.4} />
          <Path d="M0 144 C40 136 60 152 100 144 C140 136 160 152 200 144 C240 136 260 152 300 144 C340 136 360 152 400 144" opacity={0.28} />
        </G>
      ) : null}

      {preset === 'dusk' ? (
        <G>
          <Circle cx="200" cy="118" r="70" fill={`url(#${id}-glow)`} opacity={0.6} />
          <Circle cx="200" cy="118" r="36" fill="#F8C9A4" />
          <Rect x="0" y="122" width="400" height="38" fill="#C9857E" opacity={0.55} />
          <Rect x="0" y="138" width="400" height="22" fill="#B87470" opacity={0.5} />
        </G>
      ) : null}
    </Svg>
  );
}

/** 主页背景：预设图案或者自己上传的照片，铺满外面的容器。 */
export function ProfileBackgroundView({ background, style }: { background: ProfileBackground; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.fill, style]}>
      {background.kind === 'photo' ? (
        <Image source={{ uri: profileImageUri(background.image) }} style={styles.fill} contentFit="cover" transition={150} />
      ) : (
        <PresetArt preset={background.preset} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
});
