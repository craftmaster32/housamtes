import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface CartArtProps {
  size?: number;
  ink: string;
  /** Wheel fill, so the wheels read as round on any card colour. */
  paper: string;
}

/** A shopping cart with a baguette, a bottle, an orange and greens peeking out. */
export function CartArt({ size = 64, ink, paper }: CartArtProps): React.JSX.Element {
  return (
    <Svg width={size} height={size * 0.76} viewBox="0 0 86 65" fill="none">
      <Path
        d="M27 18 l4 -14 h6 l-3 14"
        fill="#F2D49B"
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Rect
        x={38}
        y={6}
        width={10}
        height={16}
        rx={3}
        fill="#D6E4F7"
        stroke={ink}
        strokeWidth={2}
      />
      <Path d="M40.5 6 v-3 h5 v3" stroke={ink} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={57} cy={14} r={7} fill="#F2B84B" stroke={ink} strokeWidth={2} />
      <Path d="M57 7 q3 -4 6 -3" stroke="#3A8A4F" strokeWidth={2} strokeLinecap="round" />
      <Path
        d="M64 19 q6 -14 12 -8 q-2 6 -8 9"
        fill="#7CB66E"
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M3 6 h9 l9 36 h46 l9 -24 h-62"
        stroke={ink}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M23 26 h48 M26 34 h40" stroke={ink} strokeWidth={1.4} opacity={0.45} />
      <Path d="M21 42 l-3 7 h52" stroke={ink} strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={27} cy={56} r={4.5} fill={paper} stroke={ink} strokeWidth={2.6} />
      <Circle cx={62} cy={56} r={4.5} fill={paper} stroke={ink} strokeWidth={2.6} />
    </Svg>
  );
}
