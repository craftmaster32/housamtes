import Svg, { Circle, Path } from 'react-native-svg';

const BRASS = '#E2B54C';
const TAG = '#FBF3D3';

interface KeyArtProps {
  width: number;
  /** Outline colour — the page's text colour, so it shows on light and dark. */
  ink: string;
}

// A brass house key on a ring with a cream tag — for logging in and for
// getting a new password.
export function KeyArt({ width, ink }: KeyArtProps): React.JSX.Element {
  return (
    <Svg width={width} height={width} viewBox="0 0 72 72" fill="none">
      {/* Ring */}
      <Circle cx={22} cy={20} r={11} stroke="#A39D92" strokeWidth={3} />
      {/* Tag on the ring */}
      <Path
        d="M10 30 L4 44 Q3 47 6 48 L16 52 Q19 53 20 50 L25 37"
        fill={TAG}
        stroke={ink}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Circle cx={15} cy={36} r={1.8} fill={ink} />
      {/* Key bow */}
      <Circle cx={36} cy={32} r={9} fill={BRASS} stroke={ink} strokeWidth={2.4} />
      <Circle cx={36} cy={32} r={3} fill={TAG} stroke={ink} strokeWidth={1.8} />
      {/* Blade with teeth */}
      <Path
        d="M42 38 L64 60 L60 64 L57 61 L59 59 L55 55 L53 57 L50 54 L52 52 L46 46"
        fill={BRASS}
        stroke={ink}
        strokeWidth={2.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
