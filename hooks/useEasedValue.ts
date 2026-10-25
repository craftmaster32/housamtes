import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from '@hooks/useReduceMotion';

const EASE_MS = 260;

/**
 * An Animated.Value that glides to each new `value` instead of snapping (e.g.
 * a progress bar filling as items are bought). Jumps straight there when
 * Reduce Motion is on. JS-driven, so it can drive widths, also on the web.
 */
export function useEasedValue(value: number): Animated.Value {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(value);
      return undefined;
    }
    const timing = Animated.timing(anim, {
      toValue: value,
      duration: EASE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    timing.start();
    return (): void => timing.stop();
  }, [value, reduceMotion, anim]);
  return anim;
}
