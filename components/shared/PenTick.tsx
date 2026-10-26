import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { usePenStroke } from '@hooks/usePenStroke';

const TICK = 'M4 13 L10.5 20 L23 3';
// Length of TICK in its 26×26 box, so the stroke can be drawn bit by bit.
const LENGTH = Math.hypot(6.5, 7) + Math.hypot(12.5, 17);

interface PenTickProps {
  checked: boolean;
  size: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  strokeWidth?: number;
}

/**
 * A blue-pen tick that is drawn in one quick stroke when ticked and lifts off
 * when un-ticked, instead of popping in and out. Already-ticked items show it
 * whole straight away; Reduce Motion shows the end state.
 */
export function PenTick({
  checked,
  size,
  color,
  style,
  strokeWidth = 3,
}: PenTickProps): React.JSX.Element | null {
  const progress = usePenStroke(checked);
  if (progress <= 0) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" style={style} pointerEvents="none">
      <Path
        d={TICK}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={`${LENGTH} ${LENGTH}`}
        strokeDashoffset={LENGTH * (1 - progress)}
      />
    </Svg>
  );
}
