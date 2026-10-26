import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { directionTo } from '@utils/routeDirection';

interface RouteTransitionProps {
  children: React.ReactNode;
}

// A calm page change, played whenever the route changes. The app is one hidden
// tab navigator that hard-cuts forward navigation on purpose (see the note in
// app/(tabs)/_layout.tsx — the bottom-tabs `animation` option leaves the
// previous screen mounted), so without this every page change snaps. Going
// forward, the new page rises a little into place as it fades in; going back,
// it settles down from just above — so the direction is felt without any
// sideways slide, which would fight the browser's own back-swipe on the web.
//
// RN Animated (not reanimated): reanimated's animations don't run on this
// app's web build, which is where the owner uses it.
const DURATION_MS = 300;
const RISE_PX = 18;
const SETTLE_PX = -12;

export function RouteTransition({ children }: RouteTransitionProps): React.JSX.Element {
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(1)).current;
  const from = useRef(new Animated.Value(RISE_PX)).current;
  const first = useRef(true);
  // Worked out once per page change (effects can run twice in development).
  const handled = useRef<{ path: string; direction: 'forward' | 'back' } | null>(null);

  useEffect(() => {
    if (handled.current?.path !== pathname) {
      handled.current = { path: pathname, direction: directionTo(pathname) };
    }
    const { direction } = handled.current;
    // The app's first screen just appears; only changes of page move.
    if (first.current || reduceMotion) {
      first.current = false;
      progress.setValue(1);
      return undefined;
    }
    from.setValue(direction === 'back' ? SETTLE_PX : RISE_PX);
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return (): void => anim.stop();
  }, [pathname, reduceMotion, progress, from]);

  const translateY = Animated.multiply(
    from,
    progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })
  );

  return (
    <Animated.View style={[styles.fill, { opacity: progress, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
