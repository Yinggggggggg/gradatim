import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** 统一的线条图标，24 × 24 的画布，颜色和粗细跟着传进来的值走。 */
type IconProps = { size?: number; color: string; strokeWidth?: number };

function Icon({ size = 24, color, strokeWidth = 1.8, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 5v14" />
      <Path d="M5 12h14" />
    </Icon>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v6" />
      <Path d="M12 7.5v.5" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Rect x={4} y={6} width={16} height={12} rx={2} />
      <Path d="M4 15l4-4 4 4 3-3 5 5" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M4 8h3l2-2.5h6L17 8h3v11H4z" />
      <Circle cx={12} cy={13} r={3.5} />
    </Icon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6 12h.01" />
      <Path d="M12 12h.01" />
      <Path d="M18 12h.01" />
    </Icon>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
      <Path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </Icon>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M12 4v11" />
      <Path d="M7 10l5 5 5-5" />
      <Path d="M5 20h14" />
    </Icon>
  );
}

export function CupIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <Path d="M7 4h10v3a5 5 0 0 1-10 0V4z" />
      <Path d="M12 12v5" />
      <Path d="M8 20h8" />
    </Icon>
  );
}
