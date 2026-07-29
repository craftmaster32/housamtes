import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from 0 (on first mount) up to `target`, easing out. On later
 * `target` changes it tweens from the previous value instead of snapping. Pass
 * `enabled = false` to skip the animation and show the value directly (e.g. when
 * the user prefers reduced motion). JS-driven via requestAnimationFrame so it
 * behaves the same on native and web.
 */
export function useCountUp(target: number, enabled = true, duration = 900): number {
  const [value, setValue] = useState(enabled ? 0 : target);
  const prev = useRef(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      prev.current = target;
      return;
    }
    const from = prev.current;
    const start = Date.now();
    const tick = (): void => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(from + (target - from) * eased);
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setValue(target);
        prev.current = target;
      }
    };
    raf.current = requestAnimationFrame(tick);
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, enabled, duration]);

  return value;
}
