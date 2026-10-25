import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { type DoodleKind } from '@components/bills/art/doodleKind';

// Pen ink, as in the other hand-drawn pictures (paper stays light in dark mode).
const INK = '#22201D';
const PAPER = '#FFFFFF';
const PEPPERONI = '#E0645A';
const SIGNAL = '#A9CBEE';
const LED = '#6DB46A';

interface CategoryDoodleProps {
  kind: DoodleKind;
  /** The category's colour; the drawing is coloured in a light wash of it. */
  color: string | null;
  size: number;
}

// A light wash of the category colour, like a felt-tip colouring in.
function wash(hex: string | null): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return '#E6E1D6';
  const n = parseInt(m[1], 16);
  const mix = (v: number): number => Math.round(v + (255 - v) * 0.45);
  const rgb = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
  return `#${rgb.toString(16).padStart(6, '0')}`;
}

/**
 * A small hand-drawn picture for a bill's category: dark ink outlines,
 * coloured in with the category's colour. Same style as `BillArt`.
 */
export function CategoryDoodle({ kind, color, size }: CategoryDoodleProps): React.JSX.Element {
  const fill = wash(color);
  const line = {
    stroke: INK,
    strokeWidth: 2.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  const thin = { ...line, strokeWidth: 2 } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {kind === 'cart' && (
        <>
          <Path d="M7 13h8l7 28h27l6-19H18" {...line} />
          <Path d="M18 22h37l-6 19H22z" fill={fill} {...line} />
          <Path d="M27 28v7M36 28v7M45 28v7" {...thin} />
          <Circle cx={26} cy={51} r={4.5} fill={PAPER} {...line} />
          <Circle cx={46} cy={51} r={4.5} fill={PAPER} {...line} />
        </>
      )}
      {kind === 'pizza' && (
        <>
          <Path d="M31 9L54 50Q32 59 10 50z" fill={fill} {...line} />
          <Path d="M9 50Q32 61 55 50" {...line} strokeWidth={5} opacity={0.25} />
          <Circle cx={30} cy={28} r={3.6} fill={PEPPERONI} {...line} strokeWidth={1.6} />
          <Circle cx={37} cy={41} r={3.6} fill={PEPPERONI} {...line} strokeWidth={1.6} />
          <Circle cx={23} cy={43} r={3} fill={PEPPERONI} {...line} strokeWidth={1.6} />
        </>
      )}
      {kind === 'car' && (
        <>
          <Path d="M7 43v-8l8-3 7-11h20l9 11 6 3v8z" fill={fill} {...line} />
          <Path d="M25 24h7v8H19zM36 24h5l6 8H36z" fill={PAPER} {...thin} />
          <Circle cx={20} cy={44} r={6} fill={PAPER} {...line} />
          <Circle cx={45} cy={44} r={6} fill={PAPER} {...line} />
        </>
      )}
      {kind === 'ticket' && (
        <G rotation={-8} origin="32, 32">
          <Path d="M8 19h48v9a4 4 0 0 0 0 8v9H8v-9a4 4 0 0 0 0-8z" fill={fill} {...line} />
          <Path d="M42 21v4M42 30v4M42 39v4" {...thin} />
          <Path
            d="M24 25l2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.7 5.4-.7z"
            fill={PAPER}
            {...line}
            strokeWidth={1.8}
          />
        </G>
      )}
      {kind === 'firstaid' && (
        <>
          <Rect x={10} y={18} width={44} height={34} rx={6} fill={PAPER} {...line} />
          <Path d="M25 18v-5h14v5" {...line} />
          <Path d="M28 25h8v7h7v8h-7v7h-8v-7h-7v-8h7z" fill={fill} {...thin} />
        </>
      )}
      {kind === 'bag' && (
        <>
          <Path d="M13 24h38l-3 31H16z" fill={fill} {...line} />
          <Path d="M24 30v-9a8 8 0 0 1 16 0v9" {...line} />
        </>
      )}
      {kind === 'plane' && (
        <>
          <Path
            d="M8 36l12-1 20-20q6-5 9-2 3 3-2 9L27 42l-1 12-5 2-3-11-11-3z"
            fill={fill}
            {...line}
          />
          <Path d="M36 31l8 18-4 3-9-14" fill={PAPER} {...thin} />
        </>
      )}
      {kind === 'phone' && (
        <>
          <Rect x={20} y={7} width={24} height={50} rx={5} fill={PAPER} {...line} />
          <Rect x={24} y={13} width={16} height={32} rx={2} fill={fill} {...thin} />
          <Circle cx={32} cy={51} r={2.2} fill={INK} />
        </>
      )}
      {kind === 'bulb' && (
        <>
          <Path
            d="M32 7c-11 0-19 8-19 18 0 7 4 11 7 15 2 3 3 5 3 8h18c0-3 1-5 3-8 3-4 7-8 7-15 0-10-8-18-19-18z"
            fill={fill}
            {...line}
          />
          <Path d="M24 53h16M26 59h12" {...line} />
          <Path d="M28 31l4 6 4-6" {...line} strokeWidth={2.2} />
        </>
      )}
      {kind === 'drop' && (
        <>
          <Path
            d="M32 7C25 19 16 28 16 39a16 16 0 0 0 32 0c0-11-9-20-16-32z"
            fill={fill}
            {...line}
          />
          <Path d="M24 40q1 8 8 9" stroke={PAPER} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {kind === 'flame' && (
        <Path
          d="M33 6c2 9-9 13-9 25 0 4 2 7 4 9-6-1-11-6-11-13-5 6-6 11-6 15 0 9 9 16 21 16s21-7 21-17c0-12-12-19-20-35z"
          fill={fill}
          {...line}
        />
      )}
      {kind === 'router' && (
        <>
          <Path
            d="M18 17q14-12 28 0M24 24q8-7 16 0"
            stroke={SIGNAL}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Rect x={8} y={33} width={48} height={16} rx={5} fill={fill} {...line} />
          <Circle cx={18} cy={41} r={2.4} fill={LED} />
          <Circle cx={26} cy={41} r={2.4} fill={LED} />
          <Path d="M44 33L48 23" {...line} />
        </>
      )}
      {kind === 'house' && (
        <>
          <Path d="M12 31L32 14l20 17v23H12z" fill={PAPER} {...line} />
          <Path d="M7 33L32 11l25 22" {...line} />
          <Rect
            x={26}
            y={38}
            width={12}
            height={16}
            rx={2}
            fill={fill}
            {...line}
            strokeWidth={2.4}
          />
        </>
      )}
      {kind === 'receipt' && (
        <>
          <Path d="M16 8h32v48l-4-3-4 3-4-3-4 3-4-3-4 3-4-3-4 3z" fill={PAPER} {...line} />
          <Path
            d="M22 20h20M22 28h20M22 36h12"
            stroke={color ?? INK}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}
