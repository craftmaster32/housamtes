import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

/**
 * Counts a number up from 0 to `target` — but only **once each time the screen
 * is entered** (gains focus). While you stay on the page, later `target` changes
 * (e.g. toggling House ↔ Personal in analysis) update instantly without
 * re-running the animation. Leaving and re-entering the page runs it again.
 *
 * Tab screens stay mounted, so a plain mount effect would never re-fire on
 * re-entry — keying off focus is what makes it run every time you open the page.
 * JS/rAF-driven so it behaves identically on web and native.
 */
export function useCountUp(target: number, enabled = true, duration = 900): number {
  const isFocused = useIsFocused();
  const [value, setValue] = useState(enabled ? 0 : target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const animatingRef = useRef(false);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const ranForThisFocusRef = useRef(false);

  // Run the count-up once per focus.
  useEffect(() => {
    if (!enabled) return;
    if (!isFocused) {
      ranForThisFocusRef.current = false; // re-arm for the next entry
      return;
    }
    if (ranForThisFocusRef.current) return;
    ranForThisFocusRef.current = true;
    animatingRef.current = true;
    const start = Date.now();
    const step = (): void => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setValue(targetRef.current * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        animatingRef.current = false;
        rafRef.current = null;
        setValue(targetRef.current);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return (): void => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      animatingRef.current = false;
    };
  }, [isFocused, enabled, duration]);

  // Value changes while on the page (not animating) apply instantly.
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    if (!animatingRef.current) setValue(target);
  }, [target, enabled]);

  return enabled ? value : target;
}
