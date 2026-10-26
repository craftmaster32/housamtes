import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type MatePropKind = 'camera' | 'receipt' | 'broom' | 'car' | 'ballot' | 'pin';

interface MatePropProps {
  kind: MatePropKind;
  size: number;
  /** Outline on the filled shapes (paper stays light, so this stays dark). */
  ink: string;
  /** Bare strokes drawn straight on the page (broom stick, pin needle) — themed. */
  stroke: string;
  /** Light fill for paper / bodies (stays light in dark mode, like the app's paper). */
  paper: string;
  accent: string;
}

/** The little thing Mate is holding in a cameo, drawn in the same ink style as him. */
export function MateProp({
  kind,
  size,
  ink,
  stroke,
  paper,
  accent,
}: MatePropProps): React.JSX.Element {
  const line = {
    stroke: ink,
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {kind === 'camera' && (
        <>
          <Path d="M14 12 L16 8 H24 L26 12" fill={paper} {...line} />
          <Rect x={5} y={12} width={30} height={20} rx={4} fill={paper} {...line} />
          <Circle cx={20} cy={22} r={6} fill={accent} {...line} />
          <Circle cx={30} cy={16} r={1.2} fill={ink} />
        </>
      )}
      {kind === 'receipt' && (
        <>
          <Path
            d="M10 5 H30 V33 L27 30.5 L24 33 L21 30.5 L18 33 L15 30.5 L12 33 L10 31 Z"
            fill={paper}
            {...line}
          />
          <Path d="M14 12 H26 M14 17 H24 M14 22 H22" {...line} strokeWidth={1.6} />
        </>
      )}
      {kind === 'broom' && (
        <>
          <Path d="M28 4 L19 23" {...line} stroke={stroke} strokeWidth={2.6} />
          <Path d="M14 21 L24 25 L20 36 L6 31 Z" fill={accent} {...line} />
          <Path d="M10 33 L13 26 M14 34 L17 27" {...line} strokeWidth={1.4} />
        </>
      )}
      {kind === 'car' && (
        <>
          <Path d="M4 26 V21 L9 20 L13 13 H26 L31 20 L36 21 V26 Z" fill={accent} {...line} />
          <Path d="M15 15 H24 L27 20 H13 Z" fill={paper} {...line} strokeWidth={1.4} />
          <Circle cx={11} cy={27} r={3.6} fill={paper} {...line} />
          <Circle cx={29} cy={27} r={3.6} fill={paper} {...line} />
        </>
      )}
      {kind === 'ballot' && (
        <>
          <Rect x={8} y={6} width={24} height={28} rx={2} fill={paper} {...line} />
          <Rect x={13} y={13} width={9} height={9} rx={1} {...line} strokeWidth={1.6} />
          <Path
            d="M14 14 L21 21 M21 14 L14 21"
            stroke={accent}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
          <Path d="M13 28 H27" {...line} strokeWidth={1.4} />
        </>
      )}
      {kind === 'pin' && (
        <>
          <Path d="M20 22 L20 36" {...line} stroke={stroke} />
          <Circle cx={20} cy={14} r={9} fill={accent} {...line} />
          <Circle cx={17} cy={11} r={2.2} fill={paper} />
        </>
      )}
    </Svg>
  );
}
