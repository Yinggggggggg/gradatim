/**
 * “今天”页顶部的大圣杯，用 Skia 画：背后慢慢转的光芒、呼吸的光晕、杯后的柔光、晃动的光液和不停上升的光点。
 * 记下当天第一件事时，一颗带尾迹的光点落进杯里，激起涟漪、溅起光点，液面闪一下再涨上去。
 * 坐标都在 120 × 150 的圣杯画布里，再整体缩放到 Canvas 上。
 * 网页上 Skia 要先加载 CanvasKit，所以这个文件只由 grail-hero（手机）或 grail-hero.web 动态引入。
 */

import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useRef } from 'react';
import {
  Easing,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CUP_DAYS, grailProgress } from '@/lib/grail';

import type { GrailHeroProps } from './grail-hero-types';

const BOWL = Skia.Path.MakeFromSVGString('M14 28 C14 66 34 88 60 88 C86 88 106 66 106 28 Z')!;
const BOWL_INSIDE = Skia.Path.MakeFromSVGString('M19 30 C19 64 37 83 60 83 C83 83 101 64 101 30 Z')!;
const BAND = Skia.Path.MakeFromSVGString('M17 44 C34 50 86 50 103 44')!;
const STEM = Skia.Path.MakeFromSVGString('M53 87 L67 87 L63 99 L57 99 Z M57 109 L63 109 L65 124 L55 124 Z')!;
const FOOT = Skia.Path.MakeFromSVGString('M30 137 C40 127 50 124 60 124 C70 124 80 127 90 137 L92 141 L28 141 Z')!;

const CENTER = vec(60, 58);
const RAY_LENGTH = 112;
const RAYS = (() => {
  const builder = Skia.PathBuilder.Make();
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const spread = 0.07;
    builder.moveTo(60, 58);
    builder.lineTo(60 + Math.cos(angle - spread) * RAY_LENGTH, 58 + Math.sin(angle - spread) * RAY_LENGTH);
    builder.lineTo(60 + Math.cos(angle + spread) * RAY_LENGTH, 58 + Math.sin(angle + spread) * RAY_LENGTH);
    builder.close();
  }
  return builder.detach();
})();

const GOLD = ['#7A5418', '#E8C468', '#FFF2B8', '#D9A441', '#7A5418'];
const GOLD_STOPS = [0, 0.3, 0.5, 0.7, 1];
const LIQUID = ['#FFF6C8', '#F7CF5A', '#C98A1C'];

const LIQUID_BOTTOM = 83;
const LIQUID_TOP = 32;
/** 有了第一天，杯底就要能看出一汪光 */
const MIN_VISIBLE_LEVEL = 0.1;
const DROP_START_Y = -46;

/** 上升的光点：固定的“随机”参数，每次打开都一样 */
const SPARKS = Array.from({ length: 24 }, (_, i) => {
  const random = (n: number) => {
    const value = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  return {
    x: -12 + random(1) * 144,
    y: 36 + random(2) * 104,
    period: 2600 + random(3) * 2600,
    size: 0.8 + random(4) * 1.5,
    phase: random(5),
    sway: 2 + random(6) * 3,
  };
});

/** 落进液面时溅起的光点 */
const SPLASH = Array.from({ length: 12 }, (_, i) => {
  const angle = -Math.PI / 2 + ((i / 11) - 0.5) * 2.2;
  const speed = 16 + (i % 3) * 7;
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 1 + (i % 4) * 0.4 };
});

function levelFor(current: number): number {
  'worklet';
  if (current <= 0) return 0;
  return MIN_VISIBLE_LEVEL + (1 - MIN_VISIBLE_LEVEL) * (Math.min(current, CUP_DAYS) / CUP_DAYS);
}

function surfaceY(level: number): number {
  'worklet';
  return LIQUID_BOTTOM - level * (LIQUID_BOTTOM - LIQUID_TOP);
}

function Gold() {
  return <LinearGradient start={vec(14, 0)} end={vec(106, 0)} colors={GOLD} positions={GOLD_STOPS} />;
}

export function GrailHeroCanvas({ width, height, days, drop, active, onDropLanded }: GrailHeroProps) {
  const reduceMotion = useReducedMotion();
  const target = levelFor(grailProgress(days).current);

  const time = useSharedValue(0);
  const level = useSharedValue(target);
  const dropY = useSharedValue(DROP_START_Y);
  const dropOpacity = useSharedValue(0);
  const impactY = useSharedValue(LIQUID_BOTTOM);
  const ripple = useSharedValue(0);
  const flash = useSharedValue(0);
  const played = useRef<number | null>(null);
  const onLanded = useRef(onDropLanded);

  useEffect(() => {
    onLanded.current = onDropLanded;
  }, [onDropLanded]);

  const frame = useFrameCallback((info) => {
    time.set(info.timeSinceFirstFrame);
  }, false);

  useEffect(() => {
    frame.setActive(active && !reduceMotion);
  }, [frame, active, reduceMotion]);

  useEffect(() => {
    if (!drop || played.current === drop.id) {
      level.set(withTiming(target, { duration: 500 }));
      return;
    }
    played.current = drop.id;
    const from = grailProgress(drop.from);
    const to = grailProgress(drop.to);
    // 跨过一杯（第 100 天到第 101 天）时，新的一杯从空杯开始
    const start = from.fullCups === to.fullCups ? levelFor(from.current) : 0;
    const end = levelFor(to.current);
    const landed = () => onLanded.current?.();

    if (reduceMotion) {
      level.set(end);
      landed();
      return;
    }

    const impact = surfaceY(Math.max(start, MIN_VISIBLE_LEVEL / 2));
    level.set(start);
    impactY.set(impact);
    dropOpacity.set(withSequence(withTiming(1, { duration: 160 }), withDelay(560, withTiming(0, { duration: 140 }))));
    dropY.set(DROP_START_Y);
    dropY.set(
      withTiming(impact, { duration: 820, easing: Easing.in(Easing.quad) }, (finished) => {
        if (!finished) return;
        ripple.set(0);
        ripple.set(withTiming(1, { duration: 950, easing: Easing.out(Easing.quad) }));
        flash.set(withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 750 })));
        level.set(withSpring(end, { damping: 12, stiffness: 70 }));
        scheduleOnRN(landed);
      }),
    );
  }, [drop, target, reduceMotion, level, dropY, dropOpacity, impactY, ripple, flash]);

  // 整个圣杯画布占 Canvas 高度的七成，水平居中
  const scale = (height * 0.7) / 150;
  const transform = [{ translateX: (width - 120 * scale) / 2 }, { translateY: height * 0.16 }, { scale }];

  const raysTransform = useDerivedValue(() => [{ rotate: (time.get() / 40000) * Math.PI * 2 }]);
  const breathe = useDerivedValue(() => (Math.sin(time.get() / 1100) + 1) / 2);
  const haloOpacity = useDerivedValue(() => 0.45 + 0.35 * breathe.get() + 0.3 * flash.get());
  const glowOpacity = useDerivedValue(() => 0.18 + 0.14 * breathe.get() + 0.4 * flash.get());

  const liquid = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    const lvl = level.get();
    if (lvl <= 0) return builder.detach();
    const top = surfaceY(lvl);
    const phase = time.get() / 430;
    builder.moveTo(10, top);
    for (let x = 10; x <= 110; x += 5) builder.lineTo(x, top + Math.sin(phase + x * 0.2) * 1.4);
    builder.lineTo(110, 96);
    builder.lineTo(10, 96);
    builder.close();
    return builder.detach();
  });
  const flashOpacity = useDerivedValue(() => flash.get() * 0.75);

  const sparks = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    const t = time.get();
    for (const spark of SPARKS) {
      const p = (t / spark.period + spark.phase) % 1;
      const radius = spark.size * Math.sin(Math.PI * p);
      if (radius <= 0.05) continue;
      builder.addCircle(spark.x + Math.sin((p + spark.phase) * 6) * spark.sway, spark.y - p * 54, radius);
    }
    return builder.detach();
  });

  const trail = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    const y = dropY.get();
    for (let k = 1; k <= 4; k++) builder.addCircle(60, y - k * 6, 3.4 - k * 0.65);
    return builder.detach();
  });

  const rippleOval = useDerivedValue(() => {
    const r = ripple.get();
    const y = surfaceY(level.get());
    const rx = 4 + r * 30;
    const ry = 1 + r * 3.4;
    return rect(60 - rx, y - ry, rx * 2, ry * 2);
  });
  const rippleOpacity = useDerivedValue(() => {
    const r = ripple.get();
    return r > 0 && r < 1 ? 1 - r : 0;
  });

  const splash = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    const r = ripple.get();
    if (r <= 0 || r >= 1) return builder.detach();
    const y0 = impactY.get();
    for (const s of SPLASH) {
      const x = 60 + s.vx * r;
      const y = y0 + s.vy * r + 34 * r * r;
      builder.addCircle(x, y, s.size * (1 - r));
    }
    return builder.detach();
  });

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Group transform={transform}>
        <Group origin={CENTER} transform={raysTransform}>
          <Path path={RAYS}>
            <RadialGradient c={CENTER} r={RAY_LENGTH} colors={['#F3D27A73', '#F3D27A00']} />
          </Path>
        </Group>
        <Circle cx={60} cy={58} r={74} opacity={haloOpacity}>
          <RadialGradient c={CENTER} r={74} colors={['#FFE7A3E6', '#E9B94938', '#E9B94900']} positions={[0, 0.55, 1]} />
        </Circle>
        <Circle cx={60} cy={56} r={40} color="#F3D27A" opacity={glowOpacity}>
          <BlurMask blur={22} style="normal" />
        </Circle>

        <Path path={BOWL} color="#FFFAEB" opacity={0.12} />
        <Group clip={BOWL_INSIDE}>
          <Path path={liquid}>
            <LinearGradient start={vec(0, LIQUID_TOP)} end={vec(0, LIQUID_BOTTOM)} colors={LIQUID} positions={[0, 0.45, 1]} />
          </Path>
          <Path path={liquid} color="#FFF8DC" opacity={flashOpacity} />
          <Oval rect={rippleOval} style="stroke" strokeWidth={0.9} color="#FFFFFF" opacity={rippleOpacity} />
        </Group>

        <Path path={BOWL} style="stroke" strokeWidth={3}>
          <Gold />
        </Path>
        <Path path={BAND} style="stroke" strokeWidth={2} opacity={0.8}>
          <Gold />
        </Path>
        <Oval rect={rect(14, 23, 92, 10)} color="#5A3B0E" opacity={0.3} />
        <Oval rect={rect(14, 23, 92, 10)} style="stroke" strokeWidth={3}>
          <Gold />
        </Oval>
        <Path path={STEM}>
          <Gold />
        </Path>
        <Oval rect={rect(50, 98, 20, 12)}>
          <Gold />
        </Oval>
        <Circle cx={60} cy={104} r={3.2} color="#C81E3A" />
        <Circle cx={59} cy={103} r={1} color="#FFFFFF" opacity={0.8} />
        <Path path={FOOT}>
          <Gold />
        </Path>

        <Path path={sparks} color="#FFE7A3" opacity={0.7}>
          <BlurMask blur={2.5} style="solid" />
        </Path>
        <Path path={splash} color="#FFF3C4">
          <BlurMask blur={1.5} style="solid" />
        </Path>

        <Group opacity={dropOpacity}>
          <Path path={trail} color="#FFE7A3" opacity={0.55}>
            <BlurMask blur={2} style="normal" />
          </Path>
          <Circle cx={60} cy={dropY} r={9} color="#FFE7A3" opacity={0.5}>
            <BlurMask blur={6} style="normal" />
          </Circle>
          <Circle cx={60} cy={dropY} r={3.6} color="#FFFDF2" />
        </Group>
      </Group>
    </Canvas>
  );
}
