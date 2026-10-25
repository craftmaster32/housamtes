import { useEffect, useRef, useState } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useReduceMotion } from '@hooks/useReduceMotion';

const DRAW_MS = 260;
const ERASE_MS = 140;
const TICK = 'M4 13 L10.5 20 L23 3';
// Length of TICK in its 26×26 box, so the stroke can be drawn bit by bit.
const LENGTH = Math.hypot(6.5, 7) + Math.hypot(12.5, 17);

interface PenTickProps {
  checked: boolean;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A blue-pen tick that is drawn in one quick stroke when ticked and lifts off
 * when un-ticked, instead of popping in and out. Already-ticked items show it
 * whole straight away; Reduce Motion shows the end state.
 */
export function PenTick({ checked, size, color, style }: PenTickProps): React.JSX.Element | null {
  const reduceMotion = useReduceMotion();
  const [progress, setProgress] = useState(checked ? 1 : 0);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const target = checked ? 1 : 0;
    const from = progressRef.current;
    if (from === target) return undefined;
    if (reduceMotion) {
      setProgress(target);
      return undefined;
    }
    const ms = (checked ? DRAW_MS : ERASE_MS) * Math.abs(target - from);
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
    // Only a change of `checked` starts a stroke; progress is read from the ref.
  }, [checked, reduceMotion]);

  if (progress <= 0) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" style={style} pointerEvents="none">
      <Path
        d={TICK}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${LENGTH} ${LENGTH}`}
        strokeDashoffset={LENGTH * (1 - progress)}
      />
    </Svg>
  );
}
