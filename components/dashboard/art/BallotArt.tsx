import Svg, { Path, Rect } from 'react-native-svg';

const INK = '#22201D';

interface BallotArtProps {
  color: string;
  width: number;
}

// A ballot box with a slip going in — the votes card's picture.
export function BallotArt({ color, width }: BallotArtProps): React.JSX.Element {
  return (
    <Svg width={width} height={width * 1.06} viewBox="0 0 66 70" fill="none">
      <Rect
        x={22}
        y={6}
        width={22}
        height={30}
        rx={3}
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={2.6}
        transform="rotate(8 33 21)"
      />
      <Path
        d="M27 18 L31 22 L39 13"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(8 33 21)"
      />
      <Rect x={8} y={32} width={50} height={34} rx={5} fill={color} stroke={INK} strokeWidth={3} />
      <Path d="M22 40 L44 40" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}
