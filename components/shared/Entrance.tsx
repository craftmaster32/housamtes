import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface EntranceProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  /** Distance (px) the content slides up from as it fades in. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Fades + slides its children in when mounted. Uses shared-value animations
 * (not reanimated's `entering=` layout animations, which don't run on
 * react-native-web) so the motion plays on web and native alike.
 */
export function Entrance({
  children,
  delay = 0,
  duration = 420,
  offset = 16,
  style,
}: EntranceProps): React.JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [progress, delay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offset }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
