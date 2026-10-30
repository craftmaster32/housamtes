import Svg, { Circle, Path, Rect, G } from 'react-native-svg';
import type { ApplianceKind } from '@stores/appliancesStore';

// The appliances are drawn in the light palette in both themes (white goods).
const BODY = '#FBFAF7';
const EDGE = '#3A3833';
const GLASS = '#D6E4F7';
const TRACK = 'rgba(58,56,51,0.14)';

interface MachineArtProps {
  kind: ApplianceKind;
  /** 0…1 of the cycle done; drawn as a ring around the door (or a bar on the dishwasher). */
  progress: number;
  running: boolean;
  /** The machine's accent colour. */
  color: string;
  size?: number;
}

const R = 17; // porthole ring radius
const RING = 2 * Math.PI * R;

/** A front-loading washer / dryer with a round door, or a dishwasher, drawn in ink. */
export function MachineArt({
  kind,
  progress,
  running,
  color,
  size = 92,
}: MachineArtProps): React.JSX.Element {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <Svg width={size} height={size * 1.08} viewBox="0 0 64 69" fill="none">
      {/* Body and the control strip along the top */}
      <Rect x={4} y={3} width={56} height={63} rx={7} fill={BODY} stroke={EDGE} strokeWidth={2} />
      <Path d="M4 16 H60" stroke={EDGE} strokeWidth={1.6} />
      <Circle cx={50} cy={9.5} r={3.2} stroke={EDGE} strokeWidth={1.5} />
      <Rect x={10} y={8} width={14} height={3} rx={1.5} fill={running ? color : TRACK} />

      {kind === 'dishwasher' ? (
        <G>
          {/* Door handle and a window with plates standing in the rack */}
          <Rect x={18} y={21} width={28} height={3} rx={1.5} fill={EDGE} />
          <Rect
            x={11}
            y={29}
            width={42}
            height={30}
            rx={4}
            fill={GLASS}
            stroke={EDGE}
            strokeWidth={1.6}
          />
          <Path d="M18 56 V40 a5 5 0 0 1 10 0 V56" stroke={EDGE} strokeWidth={1.4} fill="#FFFFFF" />
          <Path d="M30 56 V38 a5 5 0 0 1 10 0 V56" stroke={EDGE} strokeWidth={1.4} fill="#FFFFFF" />
          <Path d="M42 56 V42 a4 4 0 0 1 8 0 V56" stroke={EDGE} strokeWidth={1.4} fill="#FFFFFF" />
          {/* Progress along the strip */}
          <Rect x={10} y={8} width={14 * p} height={3} rx={1.5} fill={color} />
        </G>
      ) : (
        <G>
          {/* The round door: glass, the load inside, and the cycle as a ring */}
          <Circle cx={32} cy={41} r={R} stroke={TRACK} strokeWidth={4} />
          {running && (
            <Circle
              cx={32}
              cy={41}
              r={R}
              stroke={color}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${RING * p} ${RING}`}
              transform="rotate(-90 32 41)"
            />
          )}
          <Circle cx={32} cy={41} r={12.5} fill={GLASS} stroke={EDGE} strokeWidth={1.6} />
          {running ? (
            kind === 'dryer' ? (
              <Path
                d="M25 43 q3.5 -5 7 0 t7 0 M26 37 q3 -4 6 0 t6 0"
                stroke={color}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            ) : (
              <Path
                d="M21 44 q5.5 -4 11 0 t11 0 V49 a11 11 0 0 1 -22 0z"
                fill={color}
                opacity={0.55}
              />
            )
          ) : (
            <Path d="M26 36 q3 -3 6 0" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          )}
        </G>
      )}
      {/* Little feet */}
      <Path d="M10 66 v2 M54 66 v2" stroke={EDGE} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
