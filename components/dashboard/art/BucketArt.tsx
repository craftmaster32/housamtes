import Svg, { Circle, Path } from 'react-native-svg';

const INK = '#22201D';
const WATER = '#A9CBEE';

interface BucketArtProps {
  width: number;
}

// A bucket and sponge with a few bubbles — the chores card's picture.
export function BucketArt({ width }: BucketArtProps): React.JSX.Element {
  return (
    <Svg width={width} height={width * 1.06} viewBox="0 0 66 70" fill="none">
      <Circle cx={22} cy={14} r={4.5} stroke={WATER} strokeWidth={2.4} />
      <Circle cx={36} cy={8} r={3.5} stroke={WATER} strokeWidth={2.4} />
      <Circle cx={47} cy={15} r={5} stroke={WATER} strokeWidth={2.4} />
      <Path d="M14 34 Q33 4 52 34" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <Path
        d="M29 24 L49 19 Q52 18.5 52.6 21.5 L54 28 Q54.4 31 51.5 31.6 L32 35 Z"
        fill="#F7D774"
        stroke={INK}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Path
        d="M10 32 L56 32 L51 64 Q50.5 66 48.5 66 L17.5 66 Q15.5 66 15 64Z"
        fill={WATER}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
