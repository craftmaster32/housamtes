import Svg, { G, Path, Rect } from 'react-native-svg';

const CARD = '#FFFDF8';
const EDGE = '#9E978A';
const MARGIN = 'rgba(184,69,64,0.55)';
const PEN = '#3B6FBF';

interface ListCardsArtProps {
  size?: number;
}

/** Two index cards, the front one with a few handwritten lines. */
export function ListCardsArt({ size = 60 }: ListCardsArtProps): React.JSX.Element {
  return (
    <Svg width={size} height={size * 0.83} viewBox="0 0 60 50">
      <G transform="rotate(-9 26 22)">
        <Rect
          x={6}
          y={8}
          width={40}
          height={27}
          rx={2.5}
          fill={CARD}
          stroke={EDGE}
          strokeWidth={1.8}
        />
        <Path d="M10 15 h32" stroke={MARGIN} strokeWidth={1.6} />
      </G>
      <G transform="rotate(5 34 30)">
        <Rect
          x={14}
          y={16}
          width={40}
          height={27}
          rx={2.5}
          fill={CARD}
          stroke={EDGE}
          strokeWidth={1.8}
        />
        <Path d="M18 23 h32" stroke={MARGIN} strokeWidth={1.6} />
        <Path
          d="M18 29 h22 M18 34 h16 M18 39 h24"
          stroke={PEN}
          strokeWidth={1.6}
          strokeLinecap="round"
          opacity={0.7}
        />
      </G>
    </Svg>
  );
}
