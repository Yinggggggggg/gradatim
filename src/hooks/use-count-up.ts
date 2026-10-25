import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** 数字从上一次显示的值滚到目标值（第一次从 0 开始）。系统开了“减少动态效果”就直接显示目标值。 */
export function useCountUp(target: number, duration = 900): number {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) return;
    const from = shownRef.current;
    const started = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - started) / duration);
      const value = Math.round(from + (target - from) * (1 - (1 - t) ** 3));
      shownRef.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduceMotion]);

  return reduceMotion ? target : shown;
}
