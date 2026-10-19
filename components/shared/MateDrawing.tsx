import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useThemedColors, darkColors } from '@constants/colors';

// Mate — the little house who lives in the app. Drawn on a 120×120 grid with a
// slightly wobbly ink line so he reads as hand-drawn. This is the still
// drawing; `Mate` and `LoadingSpinner` animate it by changing the pose props.
const VIEW = 120;
// The antenna arm swings around its shoulder, where it meets the wall.
const ARM_PIVOT = '97 73';
const INK = '#22201D';
const CHEEK = '#F0A9A5';

interface MateDrawingProps {
  size: number;
  /** Arm rotation in degrees; 0 is resting. */
  armAngle?: number;
  eyesClosed?: boolean;
  /** Force the dark-background colours (e.g. on the always-dark splash). */
  onDark?: boolean;
  /** Roof colour override. */
  roofColor?: string;
}

export function MateDrawing({
  size,
  armAngle = 0,
  eyesClosed = false,
  onDark,
  roofColor,
}: MateDrawingProps): React.JSX.Element {
  const c = useThemedColors();
  const dark = onDark ?? c.background === darkColors.background;
  const roof = roofColor ?? (dark ? '#7FA4E3' : c.primary);
  const chimney = dark ? '#4E78C2' : c.primaryDark;
  const wall = dark ? '#F4F1EC' : '#FFFFFF';
  const arm = dark ? darkColors.textPrimary : c.textPrimary;
  const armTransform = `rotate(${armAngle} ${ARM_PIVOT})`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} fill="none">
      <Path
        d="M97 73 Q110 65 111 51"
        stroke={arm}
        strokeWidth={3}
        strokeLinecap="round"
        transform={armTransform}
      />
      <Circle
        cx={111}
        cy={48}
        r={4}
        fill={wall}
        stroke={arm}
        strokeWidth={2.5}
        transform={armTransform}
      />
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
  );
}
