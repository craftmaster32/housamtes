// utils/animations.ts
// Reusable animation hooks for the whole app.
// Built on react-native-reanimated v3 + expo-haptics + react-native-gesture-handler.
//
// Pattern: keep animation *logic* here so screens only handle layout + data.
// Every screen that uses these hooks gets a consistent feel for free.

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

/* ─────────────────────────────────────────────────────────────────────────────
 * Spring presets — use these everywhere instead of one-off numbers.
 * `gentle`  : default UI motion (cards mounting, modals)
 * `snappy`  : presses, toggles — overshoots a touch for liveliness
 * `bouncy`  : celebratory (chore done, vote passed)
 * `stiff`   : drag follows / gestures
 * ────────────────────────────────────────────────────────────────────────── */
export const Springs = {
  gentle: { damping: 18, stiffness: 140, mass: 0.9 },
  snappy: { damping: 14, stiffness: 220, mass: 0.7 },
  bouncy: { damping: 10, stiffness: 180, mass: 0.8 },
  stiff:  { damping: 30, stiffness: 400, mass: 0.6 },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * useCountUp(value, options)
 * Animates a number from its previous value to the new one. Returns a string
 * formatted with the supplied formatter. Use for any prominent amount.
 *
 *   const display = useCountUp(myShare, { formatter: (n) => formatFull(n, ccy) });
 *   <Text>{display}</Text>
 * ────────────────────────────────────────────────────────────────────────── */
interface CountUpOptions {
  duration?: number;
  formatter?: (n: number) => string;
  /** Skip the animation on first mount — render the final value immediately. */
  skipOnMount?: boolean;
}

export function useCountUp(
  value: number,
  { duration = 700, formatter = (n): string => n.toFixed(0), skipOnMount = false }: CountUpOptions = {},
): string {
  const fromRef = useRef(skipOnMount ? value : 0);
  const [display, setDisplay] = useState(() => fromRef.current);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current && skipOnMount) {
      isFirst.current = false;
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    isFirst.current = false;
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = Date.now();

    // Runs on the JS thread — fires every RAF. Adequate for a single hero number;
    // a proper follow-up should drive this via a Reanimated shared value + JS-free
    // text wrapper to avoid taxing the JS thread on low-end devices.
    const tick = (): void => {
      const elapsed = Date.now() - (startRef.current ?? 0);
      const t = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return (): void => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, skipOnMount]);

  return formatter(display);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * usePressScale()
 * Returns { pressed, animatedStyle, onPressIn, onPressOut } — spring scale
 * on press. Use on any Pressable that should feel tactile.
 *
 *   const { animatedStyle, onPressIn, onPressOut } = usePressScale();
 *   <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
 *     <Animated.View style={[styles.card, animatedStyle]}>...</Animated.View>
 *   </Pressable>
 * ────────────────────────────────────────────────────────────────────────── */
export function usePressScale(target = 0.96): {
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  onPressIn: () => void;
  onPressOut: () => void;
} {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = useCallback(() => { scale.value = withSpring(target, Springs.snappy); }, [scale, target]);
  const onPressOut = useCallback(() => { scale.value = withSpring(1, Springs.snappy); }, [scale]);
  return { animatedStyle, onPressIn, onPressOut };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * useFadeInUp(delay?)
 * Spring fade-in + slide-up. Returns an animated style to apply on mount.
 * Use for staggered widget reveals on a screen.
 *
 * IMPORTANT: call at the top of the component and assign to a named const —
 * do NOT inline inside JSX or inside conditionals. The hooks linter cannot
 * detect misuse when inlined, so callers must follow this pattern:
 *
 *   const heroFade = useFadeInUp(0);
 *   <Animated.View style={[styles.card, heroFade]}>...</Animated.View>
 * ────────────────────────────────────────────────────────────────────────── */
export function useFadeInUp(delay = 0, distance = 12): ReturnType<typeof useAnimatedStyle> {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withSpring(0, Springs.gentle));
  }, [delay, opacity, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * useSpringBar(value, max)
 * Returns a width-percentage shared value that springs from 0 → target on
 * mount and re-springs whenever value/max changes. Use for any progress bar.
 *
 *   const { animatedStyle } = useSpringBar(yesCount, totalVotes);
 *   <Animated.View style={[styles.bar, animatedStyle]} />
 * ────────────────────────────────────────────────────────────────────────── */
export function useSpringBar(
  value: number,
  max: number,
  options: { delay?: number } = {},
): { animatedStyle: ReturnType<typeof useAnimatedStyle>; width: SharedValue<number> } {
  const target = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withDelay(options.delay ?? 80, withSpring(target, Springs.gentle));
  }, [target, options.delay, width]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return { animatedStyle, width };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * useExpandable(isOpen)
 * Drives both opacity and a 0→1 progress value for accordions / dropdowns /
 * inline expanders. Returns a `style` you can apply, plus the raw progress
 * value if you want to interpolate other things (rotation of a caret, etc.)
 * ────────────────────────────────────────────────────────────────────────── */
export function useExpandable(isOpen: boolean): {
  containerStyle: ReturnType<typeof useAnimatedStyle>;
  caretStyle: ReturnType<typeof useAnimatedStyle>;
  progress: SharedValue<number>;
} {
  const progress = useSharedValue(isOpen ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isOpen ? 1 : 0, Springs.gentle);
  }, [isOpen, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleY: 0.95 + progress.value * 0.05 }, { translateY: (1 - progress.value) * -6 }],
  }));

  const caretStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return { containerStyle, caretStyle, progress };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * useHaptic()
 * Curated wrappers around expo-haptics. Always swallow errors (haptics
 * silently fail on web / unsupported devices).
 *
 *   const haptic = useHaptic();
 *   haptic.tap();          // every button press
 *   haptic.toggle();       // chore checked, switch flipped
 *   haptic.success();      // settle up, chore complete
 *   haptic.warn();         // confirm a destructive action
 *   haptic.error();        // failed submit
 * ────────────────────────────────────────────────────────────────────────── */
export function useHaptic(): {
  tap: () => void;
  toggle: () => void;
  success: () => void;
  warn: () => void;
  error: () => void;
} {
  return useMemo(() => ({
    tap:     (): void => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
    toggle:  (): void => { Haptics.selectionAsync().catch(() => {}); },
    success: (): void => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
    warn:    (): void => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); },
    error:   (): void => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
  }), []);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Layout animation presets
 * Drop these on Animated.View / FlatList rows to get smooth
 * insert/remove/reorder for free.
 *
 *   import { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
 *   <Animated.View
 *     entering={FadeIn.duration(300)}
 *     exiting={FadeOut.duration(200)}
 *     layout={LinearTransition.springify().damping(18)}
 *   />
 *
 * Re-exported here so screens don't need a second import line.
 * ────────────────────────────────────────────────────────────────────────── */
export { FadeIn, FadeInDown, FadeOut, LinearTransition, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
