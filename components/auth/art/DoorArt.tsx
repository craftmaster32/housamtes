import Svg, { Circle, Path, Rect } from 'react-native-svg';

const DOOR = '#4E82D4';
const DOOR_DARK = '#3B6FBF';
const BRASS = '#E2B54C';
const MAT = '#C9A27A';
const PLATE = '#FBF3D3';
// Details drawn on top of the door stay dark in both themes, like real paint.
const DARK = '#22201D';

interface DoorArtProps {
  width: number;
  /** Outline colour — the page's text colour, so it shows on light and dark. */
  ink: string;
}

// A blue front door with a brass knob, letterbox, number plate and a doormat —
// the welcome page's picture: this is the way into the house.
export function DoorArt({ width, ink }: DoorArtProps): React.JSX.Element {
  return (
    <Svg width={width} height={width * 1.12} viewBox="0 0 120 134" fill="none">
      {/* Frame with an arched top */}
      <Path
        d="M22 122 V44 Q22 14 60 14 Q98 14 98 44 V122"
        stroke={ink}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Door */}
      <Path
        d="M30 122 V46 Q30 22 60 22 Q90 22 90 46 V122 Z"
        fill={DOOR}
        stroke={ink}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      {/* Fan light */}
      <Path d="M42 40 Q60 28 78 40" stroke={DOOR_DARK} strokeWidth={2.4} strokeLinecap="round" />
      {/* Panels */}
      <Rect x={39} y={52} width={42} height={26} rx={3} stroke={DOOR_DARK} strokeWidth={2.4} />
      <Rect x={39} y={88} width={42} height={26} rx={3} stroke={DOOR_DARK} strokeWidth={2.4} />
      {/* Letterbox */}
      <Rect
        x={49}
        y={81}
        width={22}
        height={5}
        rx={2}
        fill={BRASS}
        stroke={DARK}
        strokeWidth={1.8}
      />
      {/* Knob */}
      <Circle cx={80} cy={84} r={3.6} fill={BRASS} stroke={DARK} strokeWidth={1.8} />
      {/* Number plate */}
      <Rect
        x={50}
        y={57}
        width={20}
        height={14}
        rx={3}
        fill={PLATE}
        stroke={DARK}
        strokeWidth={1.8}
      />
      <Path
        d="M55 61 L55 66.5 L59 66.5 M58 60.5 V68 M62.5 61.5 Q65.5 59.5 66 62 Q66 64 62.5 67.5 H66.5"
        stroke={DARK}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Step + doormat */}
      <Path d="M2 122 H112" stroke={ink} strokeWidth={3} strokeLinecap="round" />
      <Path
        d="M34 124 H86 L90 131 H30 Z"
        fill={MAT}
        stroke={ink}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* Little plant by the door */}
      <Path
        d="M14 120 L16 106 H4 L6 120 Z"
        fill="#D97A55"
        stroke={ink}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M10 106 Q16 96 14 88 M10 106 Q4 98 6 90 M10 106 V92"
        stroke="#4FA36A"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}
