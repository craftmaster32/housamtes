import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useThemedColors, darkColors } from '@constants/colors';

export type NestiMood = 'hello' | 'wink' | 'sleepy' | 'cheer';

export interface NestiProps {
  mood?: NestiMood;
  size?: number;
  /** Omit when Nesti sits next to text that already says what's going on. */
  accessibilityLabel?: string;
}

const CHEEK = '#F0A9A5';

/**
 * Nesti, the house. A small hand-drawn house with a face that turns up at the
 * moments that matter: empty states, nudges and celebrations. The slightly
 * uneven lines are on purpose, so it reads as drawn rather than generated.
 */
export function Nesti({
  mood = 'hello',
  size = 64,
  accessibilityLabel,
}: NestiProps): React.JSX.Element {
  const C = useThemedColors();
  const isDark = C.background === darkColors.background;
  // Dark mode flips Nesti to a pale house with a soft blue roof so it still
  // reads against the navy canvas.
  const roof = isDark ? '#9DBDEB' : C.primary;
  const body = isDark ? '#EEF2F8' : '#FFFDF8';
  const ink = isDark ? '#0A0F1B' : '#1F2A44';
  const chimney = isDark ? C.primary : C.primaryDark;
  const line = {
    stroke: ink,
    strokeWidth: 3,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
      testID={`nesti-${mood}`}
    >
      {mood === 'cheer' && (
        <>
          <Path d="M23 74 Q10 66 9 52" fill="none" {...line} />
          <Circle cx={9} cy={49} r={4} fill={body} {...line} strokeWidth={2.5} />
          <Path d="M97 73 Q110 65 111 51" fill="none" {...line} />
          <Circle cx={111} cy={48} r={4} fill={body} {...line} strokeWidth={2.5} />
        </>
      )}
      <Rect x={79} y={19} width={12} height={24} rx={3} fill={chimney} {...line} />
      <Path d="M23 54 Q22 106 30 107 L91 108 Q99 107 98 98 L97 54" fill={body} {...line} />
      <Path
        d="M13 57 Q12 52 17 49 L56 21 Q60 18 64 21 L103 50 Q107 53 106 57 Q105 61 100 61 L19 60 Q14 61 13 57Z"
        fill={roof}
        {...line}
      />
      <Ellipse cx={39} cy={89} rx={5.5} ry={3.4} fill={CHEEK} />
      <Ellipse cx={81} cy={88} rx={5.5} ry={3.4} fill={CHEEK} />
      {mood === 'hello' && (
        <>
          <Circle cx={48} cy={79} r={4.2} fill={ink} />
          <Circle cx={72} cy={78} r={4.2} fill={ink} />
          <Path d="M51 89 Q60 97 69 88.5" fill="none" {...line} />
        </>
      )}
      {mood === 'wink' && (
        <>
          <Circle cx={48} cy={79} r={4.2} fill={ink} />
          <Path d="M67 79 Q72 75 77 79" fill="none" {...line} />
          <Path d="M50 88 Q60 98 70 88" fill="none" {...line} />
        </>
      )}
      {mood === 'sleepy' && (
        <>
          <Path d="M43 80 Q48 84 53 80 M67 79 Q72 83 77 79" fill="none" {...line} />
          <Path d="M55 92 Q60 94 65 92" fill="none" {...line} />
        </>
      )}
      {mood === 'cheer' && (
        <>
          <Path d="M43 80 Q48 74 53 80 M67 79 Q72 73 77 79" fill="none" {...line} />
          <Path d="M50 87 Q60 101 70 87 Z" fill={ink} {...line} />
        </>
      )}
    </Svg>
  );
}
