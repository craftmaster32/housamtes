import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { MateDrawing } from '@components/shared/MateDrawing';

const BLINK_EVERY_MS = 4200;
const BLINK_FOR_MS = 140;
const WAVE_DELAY_MS = 500;
const WAVE_MS = 1000;

interface MateProps {
  size?: number;
  /** Wave hello once when he appears. Skipped when Reduce Motion is on. */
  wave?: boolean;
}

// Wave: a few decaying swings of the arm, like a quick "hi!".
function waveAngle(t: number): number {
  return -16 * Math.sin(t * Math.PI * 3) * (1 - t);
}

/**
 * Mate on the home screen: waves once when he appears and blinks now and then.
 * Driven by requestAnimationFrame + state, not reanimated — reanimated's
 * animations don't run on this app's web build (see Entrance.tsx).
 */
export function Mate({ size = 68, wave = true }: MateProps): React.JSX.Element {
  const reduceMotion = useReduceMotion();
  const [armAngle, setArmAngle] = useState(0);
  const [eyesClosed, setEyesClosed] = useState(false);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (!wave || reduceMotion) return;
    const begin = Date.now() + WAVE_DELAY_MS;
    const loop = (): void => {
      const now = Date.now();
      if (now >= begin) {
        const t = Math.min(1, (now - begin) / WAVE_MS);
        setArmAngle(waveAngle(t));
        if (t >= 1) return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [wave, reduceMotion]);

  // A blink every few seconds keeps him alive without drawing the eye.
  useEffect(() => {
    if (reduceMotion) return;
    let reopen: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      setEyesClosed(true);
      reopen = setTimeout(() => setEyesClosed(false), BLINK_FOR_MS);
    }, BLINK_EVERY_MS);
    return (): void => {
      clearInterval(id);
      if (reopen) clearTimeout(reopen);
    };
  }, [reduceMotion]);

  return (
    <View testID="mate" accessible accessibilityRole="image" accessibilityLabel="Mate">
      <MateDrawing size={size} armAngle={armAngle} eyesClosed={eyesClosed} />
    </View>
  );
}
