import Svg, { Path, Rect } from 'react-native-svg';

const PAPER = '#FFFDF8';
const LETTER = '#FBF3D3';
const STAMP = '#E5645F';

interface EnvelopeArtProps {
  width: number;
  /** Outline colour — the page's text colour, so it shows on light and dark. */
  ink: string;
}

// An opened envelope with a letter peeking out and a stamp in the corner —
// "check your inbox".
export function EnvelopeArt({ width, ink }: EnvelopeArtProps): React.JSX.Element {
  return (
    <Svg width={width} height={width * 0.86} viewBox="0 0 80 69" fill="none">
      {/* Letter */}
      <Rect
        x={16}
        y={6}
        width={48}
        height={40}
        rx={3}
        fill={LETTER}
        stroke={ink}
        strokeWidth={2.2}
      />
      <Path
        d="M24 16 H52 M24 23 H56 M24 30 H46"
        stroke="#3B6FBF"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      {/* Envelope body */}
      <Path
        d="M6 30 L40 50 L74 30 V62 Q74 65 71 65 H9 Q6 65 6 62 Z"
        fill={PAPER}
        stroke={ink}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <Path d="M6 64 L32 45 M74 64 L48 45" stroke={ink} strokeWidth={2.2} strokeLinecap="round" />
      {/* Stamp */}
      <Rect
        x={58}
        y={50}
        width={10}
        height={10}
        rx={1.5}
        fill={STAMP}
        stroke={ink}
        strokeWidth={1.6}
      />
    </Svg>
  );
}
