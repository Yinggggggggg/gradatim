import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/** 从 0 长到 fraction 的进度条，delay 毫秒后开始长。 */
export function AnimatedBar({ fraction, color, delay = 0 }: { fraction: number; color: string; delay?: number }) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(withDelay(delay, withTiming(fraction, { duration: 800, easing: Easing.out(Easing.cubic) })));
  }, [fraction, delay, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View style={[styles.track, { backgroundColor: theme.border }]}>
      <Animated.View style={[styles.bar, { backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: 8,
    borderRadius: 4,
  },
});
