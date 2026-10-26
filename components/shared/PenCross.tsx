import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { usePenStroke } from '@hooks/usePenStroke';

// Two strokes in a 26×26 box: top-left to bottom-right, then top-right down.
const FIRST = 'M4 5 L21 22';
const SECOND = 'M21 4 L5 21';
const FIRST_LEN = Math.hypot(17, 17);
const SECOND_LEN = Math.hypot(16, 17);
// The whole cross takes a little longer than a tick: two strokes.
const DRAW_MS = 300;
const ERASE_MS = 130;

interface PenCrossProps {
  checked: boolean;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A blue-pen cross for ballot boxes, drawn the way a hand does it — one
 * stroke, then the other — and lifted off when the choice changes.
 */
export function PenCross({ checked, size, color, style }: PenCrossProps): React.JSX.Element | null {
  const progress = usePenStroke(checked, DRAW_MS, ERASE_MS);
  if (progress <= 0) return null;
  // The first stroke takes the first half of the time, the second the rest.
  const first = Math.min(1, progress * 2);
  const second = Math.max(0, progress * 2 - 1);
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" style={style} pointerEvents="none">
      <Path
        d={FIRST}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${FIRST_LEN} ${FIRST_LEN}`}
        strokeDashoffset={FIRST_LEN * (1 - first)}
      />
      {second > 0 && (
        <Path
          d={SECOND}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${SECOND_LEN} ${SECOND_LEN}`}
          strokeDashoffset={SECOND_LEN * (1 - second)}
        />
      )}
    </Svg>
  );
}
