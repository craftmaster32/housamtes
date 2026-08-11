import { useEffect, useRef, useState } from 'react';
import { View, AccessibilityInfo, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemedColors } from '@constants/colors';

interface LoadingSpinnerProps {
  /** Loader width in px. The house keeps a fixed 280:150 aspect, so height
   *  follows automatically. Default 96. */
  size?: number;
  /** Line colour. Defaults to the theme's brand blue, so it follows light/dark. */
  color?: string;
  /** How long one draw → hold → fade cycle takes, in ms. Default 1700. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

// The house drawn as one continuous line: ground → up the wall → out to the
// eave → up to the roof peak → down the far side → down the wall → ground, then
// the pen carries on into a floating window. Coordinates live in a 280×150 box.
const VIEWBOX_W = 280;
const VIEWBOX_H = 150;
const STROKE = 7; // line thickness, in viewBox units
const HOUSE_PTS = [
  [24, 120],
  [92, 120],
  [92, 72],
  [76, 72],
  [140, 34],
  [204, 72],
  [188, 72],
  [188, 120],
  [256, 120],
];
const WINDOW_PTS = [
  [104, 82],
  [132, 82],
  [132, 108],
  [104, 108],
  [104, 82],
];

const toPath = (pts: number[][]): string =>
  pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');

const PATH_D = `${toPath(HOUSE_PTS)} ${toPath(WINDOW_PTS)}`;

// Total drawn length — the sum of every straight segment. The pen-up jump from
// the house to the window adds nothing, so we sum each polyline on its own.
const polylineLength = (pts: number[][]): number =>
  pts.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const LENGTH = polylineLength(HOUSE_PTS) + polylineLength(WINDOW_PTS);

// Cycle timing, as fractions of `duration`: draw the line on, hold it whole,
// then fade it out. When the loop wraps, the line is invisible and empty, so
// the restart never flashes.
const DRAW_END = 0.6;
const HOLD_END = 0.82;

/**
 * HouseMates' loading indicator: a single continuous line that draws a little
 * house (with a window), holds, fades, and repeats.
 *
 * The draw-on is a stroke-dashoffset sweep driven by requestAnimationFrame —
 * NOT reanimated. Reanimated's shared-value animations don't run on this app's
 * react-native-web build (see components/shared/Entrance.tsx), so rAF is the one
 * approach that animates on both web and native.
 */
export function LoadingSpinner({
  size = 96,
  color,
  duration = 1700,
  style,
  accessibilityLabel = 'Loading',
}: LoadingSpinnerProps): React.JSX.Element {
  const C = useThemedColors();
  const lineColor = color ?? C.primary;

  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReduceMotion(on);
    });
    return (): void => {
      alive = false;
    };
  }, []);

  const [progress, setProgress] = useState(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  useEffect(() => {
    if (reduceMotion) return;
    const start = Date.now();
    const loop = (): void => {
      setProgress(((Date.now() - start) % duration) / duration);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [duration, reduceMotion]);

  // Reduced motion: skip the animation and just show the finished house.
  let dashOffset = 0;
  let strokeOpacity = 1;
  if (!reduceMotion) {
    if (progress < DRAW_END) {
      dashOffset = LENGTH * (1 - progress / DRAW_END);
    } else if (progress < HOLD_END) {
      dashOffset = 0;
    } else {
      dashOffset = 0;
      strokeOpacity = 1 - (progress - HOLD_END) / (1 - HOLD_END);
    }
  }

  const width = size;
  const height = (size * VIEWBOX_H) / VIEWBOX_W;

  return (
    <View
      style={[{ width, height }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
        <Path
          d={PATH_D}
          stroke={lineColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={[LENGTH, LENGTH]}
          strokeDashoffset={dashOffset}
          strokeOpacity={strokeOpacity}
        />
      </Svg>
    </View>
  );
}
