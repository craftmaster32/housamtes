import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

const DRAW_MS = 360;
const STEPS = 72;
// The pen goes a little past where it started, like a real quick circle.
const TURNS = 1.1;
// …and drifts outwards as it goes, so the two ends don't sit on top of each other.
const DRIFT = 0.06;

interface PenCircleProps {
  color: string;
  /** Where the ring sits; it fills this box. Usually absolute around a word. */
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
}

// A loop through the box: an ellipse for squarish boxes, a rounder-cornered
// pill for wide words. Returns the SVG path and its length.
function loopPath(w: number, h: number, sw: number): { d: string; length: number } {
  const n = w / h > 1.6 ? 3 : 2; // superellipse exponent: 2 = ellipse
  const a = (w / 2 - sw) / (1 + DRIFT);
  const b = (h / 2 - sw) / (1 + DRIFT);
  const start = -Math.PI * 0.6; // begin top-left, like a right-handed pen
  const pts: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const f = i / STEPS;
    const t = start + f * TURNS * 2 * Math.PI;
    const grow = 1 + DRIFT * f;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = w / 2 + a * grow * Math.sign(c) * Math.abs(c) ** (2 / n);
    const y = h / 2 + b * grow * Math.sign(s) * Math.abs(s) ** (2 / n);
    pts.push([x, y]);
  }
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const d = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  return { d, length };
}

/**
 * The hand-drawn ring around a chosen word, day or option. It draws itself in
 * one quick pen stroke when it appears (instantly with Reduce Motion on).
 */
export function PenCircle({ color, style, strokeWidth = 2 }: PenCircleProps): React.JSX.Element {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [progress, setProgress] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  }, []);

  useEffect(() => {
    let frame = 0;
    let alive = true;
    const run = (reduce: boolean): void => {
      if (!alive) return;
      if (reduce) {
        setProgress(1);
        return;
      }
      const t0 = Date.now();
      const tick = (): void => {
        if (!alive) return;
        const f = Math.min(1, (Date.now() - t0) / DRAW_MS);
        setProgress(1 - (1 - f) ** 3); // ease-out: quick start, settles in
        if (f < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .then(run)
      .catch(() => run(false));
    return (): void => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  const path = useMemo(
    () => (size.w > 0 && size.h > 0 ? loopPath(size.w, size.h, strokeWidth) : null),
    [size, strokeWidth]
  );

  return (
    <View style={style} onLayout={handleLayout} pointerEvents="none">
      {path && progress > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path
            d={path.d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${path.length} ${path.length}`}
            strokeDashoffset={path.length * (1 - progress)}
          />
        </Svg>
      )}
    </View>
  );
}
