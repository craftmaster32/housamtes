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

// A light, direction-agnostic fade played whenever the route changes. The app is
// one hidden tab navigator that hard-cuts forward navigation on purpose (see the
// note in app/(tabs)/_layout.tsx — the bottom-tabs `animation` option leaves the
// previous screen mounted), so entering a page or moving between pages otherwise
// snaps instantly. This softens that into a quick fade at the content level,
// which never touches the navigator's own transition. It's kept short and starts
// only part-way faded so it doesn't fight the browser's back-swipe animation on
// web.
export function RouteTransition({ children }: RouteTransitionProps): React.JSX.Element {
  const pathname = usePathname();
  const opacity = useSharedValue(1);

  useEffect((): void => {
    opacity.value = 0.6;
    opacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) });
  }, [pathname, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
