import { useEffect, useRef, useState } from 'react';

/**
 * Tweens a number toward `target` whenever it changes, easing out. Driven by
 * requestAnimationFrame + React state (not reanimated, which doesn't animate on
 * this react-native-web build). Starts at `target`, so the first render is
 * already correct and only later changes animate.
 */
export function useTween(target: number, duration = 260, delay = 0): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    const begin = Date.now() + delay;
    const loop = (): void => {
      const now = Date.now();
      if (now < begin) {
        raf.current = requestAnimationFrame(loop);
        return;
      }
      const t = Math.min(1, (now - begin) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const v = from + (target - from) * eased;
      setValue(v);
      fromRef.current = v;
      if (t < 1) {
        raf.current = requestAnimationFrame(loop);
      } else {
        setValue(target);
        fromRef.current = target;
      }
    };
    raf.current = requestAnimationFrame(loop);
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, duration, delay]);

  return value;
}
