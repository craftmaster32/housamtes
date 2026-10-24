import Svg, { Circle, Path } from 'react-native-svg';

const INK = '#22201D';
const GLASS = '#F4F1EC';

interface CarArtProps {
  color: string;
  width: number;
}

// A small hand-drawn car — the parking card's "someone is parked" picture.
export function CarArt({ color, width }: CarArtProps): React.JSX.Element {
  return (
    <Svg width={width} height={width * 0.72} viewBox="0 0 80 58" fill="none">
      <Path
        d="M8 37 Q7 27 16 26 L22 15 Q24 11 30 11 L50 11 Q56 11 59 16 L65 26 Q73 27 73 36 L73 42 Q73 45 70 45 L11 45 Q8 45 8 42Z"
        fill={color}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <Path
        d="M28 16 L24 25 L38 25 L38 16Z M43 16 L43 25 L59 25 L55 17Z"
        fill={GLASS}
        stroke={INK}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Circle cx={69} cy={33} r={2.6} fill="#F7D774" stroke={INK} strokeWidth={2} />
      <Circle cx={23} cy={45} r={7} fill={INK} />
      <Circle cx={58} cy={45} r={7} fill={INK} />
      <Circle cx={23} cy={45} r={2.4} fill={GLASS} />
      <Circle cx={58} cy={45} r={2.4} fill={GLASS} />
    </Svg>
  );
}
