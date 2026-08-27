import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { usePathname } from 'expo-router';

interface RouteTransitionProps {
  children: React.ReactNode;
}

// A smooth, direction-agnostic "rise and fade" played whenever the route
// changes. The app is one hidden tab navigator that hard-cuts forward navigation
// on purpose (see the note in app/(tabs)/_layout.tsx — the bottom-tabs
// `animation` option leaves the previous screen mounted), so entering a page or
// moving between pages otherwise snaps instantly. This eases the new content in
// — a gentle upward glide with a fade — at the content level, so it never
// touches the navigator's own transition. The motion is vertical so it doesn't
// fight the browser's horizontal back-swipe animation on web.
const DURATION_MS = 280;
const RISE_PX = 14;

export function RouteTransition({ children }: RouteTransitionProps): React.JSX.Element {
  const pathname = usePathname();
  const progress = useSharedValue(1);

  useEffect((): void => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.cubic) });
  }, [pathname, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * RISE_PX }],
  }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
