import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';

interface LoadingSpinnerProps {
  /** Overall diameter in px. Default 44. */
  size?: number;
  /** Colour of the rotating arc and the house icon. Defaults to the brand blue. */
  color?: string;
  /** Colour of the faint full-circle track behind the arc. Defaults to the theme border. */
  trackColor?: string;
  /** How long one full revolution takes, in ms. Default 1000. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Nestiq's house-shaped loading spinner: a one-line house icon sitting still in
 * the centre while a bright arc sweeps around it like a ring.
 *
 * The rotation is driven by requestAnimationFrame on a plain View transform —
 * NOT reanimated. Reanimated's shared-value animations don't run on this app's
 * react-native-web build (see components/shared/Entrance.tsx), so rAF is the one
 * approach that animates on both web and native.
 */
export function LoadingSpinner({
  size = 44,
  color,
  trackColor,
  duration = 1000,
  style,
  accessibilityLabel = 'Loading',
}: LoadingSpinnerProps): React.JSX.Element {
  const C = useThemedColors();
  const arcColor = color ?? C.primary;
  const track = trackColor ?? C.border;

  const [angle, setAngle] = useState(0);
  const raf = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    const start = Date.now();
    const loop = (): void => {
      const elapsed = Date.now() - start;
      setAngle(((elapsed % duration) / duration) * 360);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return (): void => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [duration]);

  const stroke = Math.max(2, size * 0.09);
  const r = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * r;
  // The visible sweep is ~30% of the ring; the rest is the gap that trails it.
  const arc = circumference * 0.3;
  const iconSize = size * 0.44;

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${angle}deg` }] }]}>
        <Svg width={size} height={size}>
          <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={arcColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference - arc}`}
            fill="none"
          />
        </Svg>
      </View>
      <View style={styles.iconWrap}>
        <Ionicons name="home-outline" size={iconSize} color={arcColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
