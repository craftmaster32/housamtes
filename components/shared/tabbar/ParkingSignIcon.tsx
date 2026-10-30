import Svg, { Path, Rect } from 'react-native-svg';

interface ParkingSignIconProps {
  size: number;
  color: string;
  /** The page you're on: the sign is filled in, with a white P. */
  active: boolean;
}

// The menu's Parking icon: a P sign on a pole, like the Home parking tile's
// picture. Outlined like the other icons; filled in when it's the page you're on.
export function ParkingSignIcon({ size, color, active }: ParkingSignIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 15.5 V22" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
      <Rect
        x={5}
        y={2}
        width={14}
        height={14}
        rx={3.6}
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth={1.9}
      />
      <Path
        d="M10 12.6 V5.6 H13.2 Q15.8 5.6 15.8 8.1 Q15.8 10.6 13.2 10.6 H10"
        stroke={active ? '#FFFFFF' : color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
