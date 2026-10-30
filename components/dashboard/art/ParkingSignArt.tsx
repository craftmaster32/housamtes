import Svg, { Path, Rect } from 'react-native-svg';

const INK = '#22201D';

interface ParkingSignArtProps {
  color: string;
  lineColor: string;
  width: number;
}

// An empty bay with a "P" sign — the parking card's "it's free" picture.
export function ParkingSignArt({
  color,
  lineColor,
  width,
}: ParkingSignArtProps): React.JSX.Element {
  return (
    <Svg width={width} height={width * 0.925} viewBox="0 0 80 74" fill="none">
      <Path
        d="M8 70 L8 40 M72 70 L72 40"
        stroke={lineColor}
        strokeWidth={3}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <Path d="M40 70 L40 34" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
      <Rect x={26} y={6} width={28} height={28} rx={7} fill={color} stroke={INK} strokeWidth={3} />
      <Path
        d="M36 28 L36 13 L43 13 Q49 13 49 18.5 Q49 24 43 24 L36 24"
        stroke="#FFFFFF"
        strokeWidth={3.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
