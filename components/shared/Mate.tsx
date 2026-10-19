import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useThemedColors, darkColors } from '@constants/colors';
import { useReduceMotion } from '@hooks/useReduceMotion';

// Mate — the little house who lives on the home screen. Drawn on a 120×120
// grid with a slightly wobbly ink line so he reads as hand-drawn.
const VIEW = 120;
// The antenna arm waves around its shoulder, where it meets the wall.
const ARM_PIVOT = { x: 97, y: 73 };
const BLINK_EVERY_MS = 4200;
const BLINK_FOR_MS = 140;
const INK = '#22201D';
const CHEEK = '#F0A9A5';

interface MateProps {
  size?: number;
  /** Wave hello once when he appears. Skipped when Reduce Motion is on. */
  wave?: boolean;
}

export function Mate({ size = 68, wave = true }: MateProps): React.JSX.Element {
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
  const reduceMotion = useReduceMotion();
  const roof = isDark ? '#7FA4E3' : c.primary;
  const chimney = isDark ? '#4E78C2' : c.primaryDark;
  const wall = isDark ? '#F4F1EC' : '#FFFFFF';

  const armAngle = useSharedValue(0);
  const [eyesClosed, setEyesClosed] = useState(false);

  useEffect(() => {
    if (!wave || reduceMotion) return;
    const ease = { duration: 180, easing: Easing.inOut(Easing.quad) };
    armAngle.value = withDelay(
      500,
      withSequence(
        withTiming(-16, ease),
        withTiming(10, ease),
        withTiming(-12, ease),
        withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) })
      )
    );
  }, [wave, reduceMotion, armAngle]);

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

  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armAngle.value}deg` }],
  }));
  const pivot = {
    transformOrigin: [(ARM_PIVOT.x / VIEW) * size, (ARM_PIVOT.y / VIEW) * size, 0],
  };

  return (
    <View
      style={{ width: size, height: size }}
      testID="mate"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Mate"
    >
      <Animated.View style={[StyleSheet.absoluteFill, pivot, armStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none">
          <Path
            d="M97 73 Q110 65 111 51"
            stroke={c.textPrimary}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Circle cx={111} cy={48} r={4} fill={wall} stroke={c.textPrimary} strokeWidth={2.5} />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none">
        <Rect
          x={79}
          y={19}
          width={12}
          height={24}
          rx={3}
          fill={chimney}
          stroke={INK}
          strokeWidth={3}
        />
        <Path
          d="M23 54 Q22 106 30 107 L91 108 Q99 107 98 98 L97 54"
          fill={wall}
          stroke={INK}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Path
          d="M13 57 Q12 52 17 49 L56 21 Q60 18 64 21 L103 50 Q107 53 106 57 Q105 61 100 61 L19 60 Q14 61 13 57Z"
          fill={roof}
          stroke={INK}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Ellipse cx={39} cy={89} rx={5.5} ry={3.4} fill={CHEEK} />
        <Ellipse cx={81} cy={88} rx={5.5} ry={3.4} fill={CHEEK} />
        {eyesClosed ? (
          <Path d="M44 80 Q48 82 52 80" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        ) : (
          <Circle cx={48} cy={79} r={4.2} fill={INK} />
        )}
        <Path
          d="M67 79 Q72 75 77 79 M51 89 Q60 97 69 88.5"
          stroke={INK}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
