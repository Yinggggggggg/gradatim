import { useEffect, useId, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { CUP_DAYS, grailProgress } from '@/lib/grail';

/*
 * 圣杯：琉璃杯身、金色杯沿和杯脚、杯柄上嵌一颗红宝石，背后有缓缓转动的光芒。
 * 杯里的光液按这一杯攒了多少天升高；每成功一天，一颗光点落进杯里，液面涨一点。
 * 坐标都在 120 × 150 的画布里，光晕和光芒的中心在 (60, 58)。
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const VIEWBOX = '0 0 120 150';
const ASPECT = 150 / 120;

const BOWL = 'M14 28 C14 66 34 88 60 88 C86 88 106 66 106 28 Z';
const BOWL_INSIDE = 'M19 30 C19 64 37 83 60 83 C83 83 101 64 101 30 Z';
const BAND = 'M17 44 C34 50 86 50 103 44';
const NECK = 'M53 87 L67 87 L63 99 L57 99 Z';
const LOWER_STEM = 'M57 109 L63 109 L65 124 L55 124 Z';
const FOOT = 'M30 137 C40 127 50 124 60 124 C70 124 80 127 90 137 L92 141 L28 141 Z';

/** 液面最低和最高的位置 */
const LIQUID_BOTTOM = 83;
const LIQUID_TOP = 32;
/** 有了第一天，杯底就要能看出一小汪光，不然 1% 根本看不见 */
const MIN_VISIBLE_LEVEL = 0.1;

/** 光点从画布上方落下，先等这么久 */
const DROP_START_Y = -12;
const DROP_DELAY = 300;

/**
 * 光芒单独画在一块正方形上，整块绕自己的中心转。正方形的中心 (60, 60) 要对准光晕中心，
 * 所以往上挪 2 个单位。光芒不超过 58 长，最外面淡到没有，转起来看不出正方形的边；
 * 中心也是淡的，透过杯身看不到一道道光线，只在杯子周围放光。
 */
const RAYS_OFFSET_Y = -2;
const RAY_LENGTH = 58;
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const spread = 0.08;
  const point = (a: number) =>
    `${(60 + Math.cos(a) * RAY_LENGTH).toFixed(1)} ${(60 + Math.sin(a) * RAY_LENGTH).toFixed(1)}`;
  return `M60 60 L${point(angle - spread)} L${point(angle + spread)} Z`;
});

const SPARKLES = [
  { x: 22, y: 34, delay: 0 },
  { x: 99, y: 24, delay: 900 },
  { x: 107, y: 70, delay: 1800 },
  { x: 13, y: 80, delay: 2600 },
  { x: 60, y: 12, delay: 1300 },
];

const MAX_MINI_CUPS = 12;
const MINI_WIDTH = 22;

function levelFor(current: number): number {
  if (current <= 0) return 0;
  return MIN_VISIBLE_LEVEL + (1 - MIN_VISIBLE_LEVEL) * (Math.min(current, CUP_DAYS) / CUP_DAYS);
}

function surfaceY(level: number): number {
  'worklet';
  return LIQUID_BOTTOM - level * (LIQUID_BOTTOM - LIQUID_TOP);
}

/** 光液的形状。底边正好在杯底，渐变就只铺在看得见的这一段：液面总是亮的，底下总是深金色 */
function wavePath(level: number, phase: number): string {
  'worklet';
  if (level <= 0) return 'M0 0';
  const top = surfaceY(level);
  let d = `M12 ${top.toFixed(2)}`;
  for (let x = 12; x <= 108; x += 6) {
    d += ` L${x} ${(top + Math.sin(phase + x * 0.2) * 1.4).toFixed(2)}`;
  }
  return `${d} L108 ${LIQUID_BOTTOM} L12 ${LIQUID_BOTTOM} Z`;
}

/** 液面处杯子的半宽，用来画液面上的那道亮光 */
function halfWidthAt(y: number): number {
  'worklet';
  return 41 * Math.sqrt(Math.max(0, (LIQUID_BOTTOM - y) / (LIQUID_BOTTOM - 30)));
}

/**
 * 渐变和裁剪用的 id。网页上 id 是整个页面共用的：几个圣杯用同一个 id 时，
 * 引用会指向页面里第一个，而它可能在一个藏起来的页面里，渐变就画不出来。
 */
function useDefIds() {
  const base = useId().replace(/[^A-Za-z0-9_-]/g, '');
  return {
    gold: `gold${base}`,
    glass: `glass${base}`,
    liquid: `liquid${base}`,
    halo: `halo${base}`,
    rays: `rays${base}`,
    bowl: `bowl${base}`,
  };
}

type DefIds = ReturnType<typeof useDefIds>;

const url = (id: string) => `url(#${id})`;

function GoldDefs({ ids }: { ids: DefIds }) {
  return (
    <Defs>
      <LinearGradient id={ids.gold} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#7A5418" />
        <Stop offset="0.3" stopColor="#E8C468" />
        <Stop offset="0.5" stopColor="#FFF2B8" />
        <Stop offset="0.7" stopColor="#D9A441" />
        <Stop offset="1" stopColor="#7A5418" />
      </LinearGradient>
      <LinearGradient id={ids.glass} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFF4D6" stopOpacity="0.32" />
        <Stop offset="1" stopColor="#F2C766" stopOpacity="0.26" />
      </LinearGradient>
      <LinearGradient id={ids.liquid} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFF6C8" />
        <Stop offset="0.45" stopColor="#F7CF5A" />
        <Stop offset="1" stopColor="#C98A1C" />
      </LinearGradient>
      <RadialGradient id={ids.halo} cx="50%" cy="50%" r="50%">
        <Stop offset="0" stopColor="#FFE7A3" stopOpacity="0.9" />
        <Stop offset="0.6" stopColor="#F5C451" stopOpacity="0.25" />
        <Stop offset="1" stopColor="#F5C451" stopOpacity="0" />
      </RadialGradient>
      <ClipPath id={ids.bowl}>
        <Path d={BOWL_INSIDE} />
      </ClipPath>
    </Defs>
  );
}

/** 杯沿、金带、杯柄、宝石和杯脚：不动的部分 */
function GoldParts({ ids }: { ids: DefIds }) {
  const gold = url(ids.gold);
  return (
    <>
      <Path d={BOWL} fill="none" stroke={gold} strokeWidth={3} />
      <Path d={BAND} fill="none" stroke={gold} strokeWidth={2} opacity={0.8} />
      <Ellipse cx={60} cy={28} rx={46} ry={5} fill="#5A3B0E" fillOpacity={0.18} stroke={gold} strokeWidth={3} />
      <Path d={NECK} fill={gold} />
      <Ellipse cx={60} cy={104} rx={10} ry={6} fill={gold} />
      <Circle cx={60} cy={104} r={3.2} fill="#C81E3A" />
      <Circle cx={59} cy={103} r={1} fill="#FFFFFF" opacity={0.8} />
      <Path d={LOWER_STEM} fill={gold} />
      <Path d={FOOT} fill={gold} />
    </>
  );
}

function Sparkle({ x, y, delay, active }: { x: number; y: number; delay: number; active: boolean }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    t.set(0);
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false)));
    return () => cancelAnimation(t);
  }, [active, delay, t]);

  const glowProps = useAnimatedProps(() => ({ cy: y - t.get() * 14, opacity: Math.sin(Math.PI * t.get()) * 0.4 }));
  const coreProps = useAnimatedProps(() => ({ cy: y - t.get() * 14, opacity: Math.sin(Math.PI * t.get()) }));

  return (
    <>
      <AnimatedCircle cx={x} cy={y} r={4} fill="#FFE9A8" animatedProps={glowProps} />
      <AnimatedCircle cx={x} cy={y} r={1.4} fill="#FFFFFF" animatedProps={coreProps} />
    </>
  );
}

/**
 * 正在装的这一杯。animateFrom 是上次看到时的天数：比现在少，就先停在那时的液面，
 * 再让一颗光点落进杯里，液面涨到现在。idle 为 false 时（比如页面不在前台）停下平时的动画。
 * 系统开了“减少动态效果”时只显示静态画面。
 */
export function Grail({
  days,
  size = 96,
  animateFrom = null,
  idle = true,
  onAnimationEnd,
}: {
  days: number;
  size?: number;
  animateFrom?: number | null;
  idle?: boolean;
  onAnimationEnd?: () => void;
}) {
  const ids = useDefIds();
  const reduceMotion = useReducedMotion();
  const target = levelFor(grailProgress(days).current);
  const playDrop = animateFrom !== null && animateFrom < days && !reduceMotion;
  // 跨过一杯（比如第 100 天到第 101 天）时，新的一杯从空杯开始
  const sameCup = animateFrom !== null && grailProgress(animateFrom).fullCups === grailProgress(days).fullCups;
  const start = playDrop && sameCup ? levelFor(grailProgress(animateFrom).current) : playDrop ? 0 : target;

  const level = useSharedValue(start);
  const phase = useSharedValue(0);
  const glow = useSharedValue(0);
  const spin = useSharedValue(0);
  const dropY = useSharedValue(DROP_START_Y);
  const dropOpacity = useSharedValue(0);
  const ripple = useSharedValue(0);
  const onEnd = useRef(onAnimationEnd);

  useEffect(() => {
    onEnd.current = onAnimationEnd;
  }, [onAnimationEnd]);

  // 平时：光液轻轻晃动，光晕呼吸，背后的光芒慢慢转。重新开始时从停下的角度接着转，不跳一下
  useEffect(() => {
    if (reduceMotion || !idle) return;
    const phaseFrom = phase.get() % (Math.PI * 2);
    const spinFrom = spin.get() % 360;
    phase.set(phaseFrom);
    phase.set(withRepeat(withTiming(phaseFrom + Math.PI * 2, { duration: 2800, easing: Easing.linear }), -1, false));
    glow.set(0);
    glow.set(withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true));
    spin.set(spinFrom);
    spin.set(withRepeat(withTiming(spinFrom + 360, { duration: 40000, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(phase);
      cancelAnimation(glow);
      cancelAnimation(spin);
    };
  }, [reduceMotion, idle, phase, glow, spin]);

  // 成功一天：光点落下，激起涟漪，液面涨上去
  useEffect(() => {
    if (!playDrop) {
      level.set(withTiming(target, { duration: 400 }));
      return;
    }
    const finish = () => onEnd.current?.();
    level.set(start);
    ripple.set(0);
    dropY.set(DROP_START_Y);
    dropOpacity.set(0);
    dropOpacity.set(withDelay(DROP_DELAY, withTiming(1, { duration: 250 })));
    dropY.set(
      withDelay(
        DROP_DELAY,
        withTiming(
          surfaceY(Math.max(start, MIN_VISIBLE_LEVEL / 2)),
          { duration: 900, easing: Easing.in(Easing.quad) },
          (finished) => {
            if (!finished) return;
            dropOpacity.set(withTiming(0, { duration: 180 }));
            ripple.set(withTiming(1, { duration: 800, easing: Easing.out(Easing.quad) }));
            level.set(
              withSpring(target, { damping: 14, stiffness: 80 }, (done) => {
                if (done) scheduleOnRN(finish);
              }),
            );
          },
        ),
      ),
    );
    return () => {
      cancelAnimation(dropY);
      cancelAnimation(dropOpacity);
      cancelAnimation(ripple);
      cancelAnimation(level);
    };
  }, [playDrop, start, target, level, dropY, dropOpacity, ripple]);

  const raysStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const haloProps = useAnimatedProps(() => ({ opacity: 0.45 + glow.get() * 0.35 + level.get() * 0.15 }));
  const liquidProps = useAnimatedProps(() => ({ d: wavePath(level.get(), phase.get()) }));
  const shineProps = useAnimatedProps(() => {
    const y = surfaceY(level.get());
    return { cy: y, rx: halfWidthAt(y) * 0.85, opacity: level.get() > 0 ? 0.7 : 0 };
  });
  const rippleProps = useAnimatedProps(() => {
    const r = ripple.get();
    return {
      cy: surfaceY(level.get()),
      rx: 4 + r * 26,
      ry: 1 + r * 3,
      opacity: r > 0 && r < 1 ? 1 - r : 0,
    };
  });
  const dropGlowProps = useAnimatedProps(() => ({ cy: dropY.get(), opacity: dropOpacity.get() * 0.45 }));
  const dropProps = useAnimatedProps(() => ({ cy: dropY.get(), opacity: dropOpacity.get() }));

  return (
    <View
      style={{ width: size, height: size * ASPECT }}
      accessibilityLabel={`圣杯：这一杯攒了 ${grailProgress(days).current} / ${CUP_DAYS} 天`}>
      <Animated.View style={[styles.rays, { width: size, height: size, top: (RAYS_OFFSET_Y * size) / 120 }, raysStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 120 120">
          <Defs>
            <RadialGradient id={ids.rays} cx={60} cy={60} r={RAY_LENGTH} gradientUnits="userSpaceOnUse">
              <Stop offset="0.3" stopColor="#F2CF73" stopOpacity="0" />
              <Stop offset="0.6" stopColor="#F2CF73" stopOpacity="0.55" />
              <Stop offset="1" stopColor="#F2CF73" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {RAYS.map((d) => (
            <Path key={d} d={d} fill={url(ids.rays)} />
          ))}
        </Svg>
      </Animated.View>
      <Svg width="100%" height="100%" viewBox={VIEWBOX} style={StyleSheet.absoluteFill}>
        <GoldDefs ids={ids} />
        <AnimatedCircle cx={60} cy={58} r={58} fill={url(ids.halo)} animatedProps={haloProps} />
        <Path d={BOWL} fill={url(ids.glass)} />
        <G clipPath={url(ids.bowl)}>
          <AnimatedPath d="M0 0" fill={url(ids.liquid)} animatedProps={liquidProps} />
          <AnimatedEllipse cx={60} cy={LIQUID_BOTTOM} rx={1} ry={1.6} fill="#FFF8DC" animatedProps={shineProps} />
          <AnimatedEllipse
            cx={60}
            cy={LIQUID_BOTTOM}
            rx={1}
            ry={1}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={0.8}
            animatedProps={rippleProps}
          />
        </G>
        <GoldParts ids={ids} />
        {SPARKLES.map((sparkle) => (
          <Sparkle key={`${sparkle.x}-${sparkle.y}`} {...sparkle} active={idle && !reduceMotion} />
        ))}
        <AnimatedCircle cx={60} cy={DROP_START_Y} r={8} fill="#FFE7A3" animatedProps={dropGlowProps} />
        <AnimatedCircle cx={60} cy={DROP_START_Y} r={3.2} fill="#FFFDF2" animatedProps={dropProps} />
      </Svg>
    </View>
  );
}

function MiniCup() {
  const ids = useDefIds();
  return (
    <Svg width={MINI_WIDTH} height={MINI_WIDTH * ASPECT} viewBox={VIEWBOX}>
      <GoldDefs ids={ids} />
      <Path d={BOWL} fill={url(ids.liquid)} />
      <GoldParts ids={ids} />
    </Svg>
  );
}

/** 已经装满的杯子，排成一排小圣杯。 */
export function FullCups({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={styles.miniRow} accessibilityLabel={`已经装满 ${count} 杯`}>
      {Array.from({ length: Math.min(count, MAX_MINI_CUPS) }, (_, i) => (
        <MiniCup key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rays: {
    position: 'absolute',
    left: 0,
  },
  miniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
