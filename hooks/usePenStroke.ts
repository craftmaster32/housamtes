import { useEffect, useRef, useState } from 'react';
import { useReduceMotion } from '@hooks/useReduceMotion';

/**
 * How far a pen mark is drawn, 0 → 1. It draws in one quick ease-out stroke
 * when `on` turns true and lifts off (quicker) when it turns false. A mark
 * that starts on is shown whole at once; Reduce Motion skips straight to the
 * end. Driven by requestAnimationFrame so it also runs on the web build.
 */
export function usePenStroke(on: boolean, drawMs = 200, eraseMs = 110): number {
  const reduceMotion = useReduceMotion();
  const [progress, setProgress] = useState(on ? 1 : 0);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const target = on ? 1 : 0;
    const from = progressRef.current;
    if (from === target) return undefined;
    if (reduceMotion) {
      setProgress(target);
      return undefined;
    }
    const ms = (on ? drawMs : eraseMs) * Math.abs(target - from);
    const t0 = Date.now();
    let frame = 0;
    const step = (): void => {
      const f = Math.min(1, (Date.now() - t0) / ms);
      const eased = 1 - (1 - f) ** 3; // ease-out, like a quick pen stroke
      setProgress(from + (target - from) * eased);
      if (f < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return (): void => cancelAnimationFrame(frame);
    // Only a change of `on` starts a stroke; progress is read from the ref.
  }, [on, reduceMotion, drawMs, eraseMs]);

  return progress;
}
