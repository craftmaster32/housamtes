import Svg, { Circle, Path, Rect } from 'react-native-svg';

const INK = '#22201D';
const YELLOW = '#F7D774';
const WATER = '#A9CBEE';
const GREEN = '#6DB46A';
const PINK = '#F2A7A0';
const FLAME = '#F5A35C';

type Kind = 'bulb' | 'drop' | 'flame' | 'router' | 'house' | 'bin' | 'receipt';

// Which picture each recurring-bill icon gets.
const KIND_BY_ICON: Record<string, Kind> = {
  'flash-outline': 'bulb',
  'water-outline': 'drop',
  'flame-outline': 'flame',
  'thermometer-outline': 'flame',
  'wifi-outline': 'router',
  'home-outline': 'house',
  business: 'house',
  'business-outline': 'house',
  'trash-outline': 'bin',
};

interface BillArtProps {
  icon: string;
  size: number;
}

/** A small hand-drawn picture for a recurring bill, in the home cards' ink style. */
export function BillArt({ icon, size }: BillArtProps): React.JSX.Element {
  const kind = KIND_BY_ICON[icon] ?? 'receipt';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {kind === 'bulb' && (
        <>
          <Path
            d="M32 7c-11 0-19 8-19 18 0 7 4 11 7 15 2 3 3 5 3 8h18c0-3 1-5 3-8 3-4 7-8 7-15 0-10-8-18-19-18z"
            fill={YELLOW}
            stroke={INK}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Path d="M24 53h16M26 59h12" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <Path d="M28 31l4 6 4-6" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
      {kind === 'drop' && (
        <>
          <Path
            d="M32 7C25 19 16 28 16 39a16 16 0 0 0 32 0c0-11-9-20-16-32z"
            fill={WATER}
            stroke={INK}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Path d="M24 40q1 8 8 9" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        </>
      )}
      {kind === 'flame' && (
        <Path
          d="M33 6c2 9-9 13-9 25 0 4 2 7 4 9-6-1-11-6-11-13-5 6-6 11-6 15 0 9 9 16 21 16s21-7 21-17c0-12-12-19-20-35z"
          fill={FLAME}
          stroke={INK}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
      )}
      {kind === 'router' && (
        <>
          <Path
            d="M18 17q14-12 28 0M24 24q8-7 16 0"
            stroke={WATER}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Rect
            x={8}
            y={33}
            width={48}
            height={16}
            rx={5}
            fill="#fff"
            stroke={INK}
            strokeWidth={2.6}
          />
          <Circle cx={18} cy={41} r={2.4} fill={GREEN} />
          <Circle cx={26} cy={41} r={2.4} fill={GREEN} />
          <Path d="M44 33L48 23" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
        </>
      )}
      {kind === 'house' && (
        <>
          <Path
            d="M12 31L32 14l20 17v23H12z"
            fill="#fff"
            stroke={INK}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Path
            d="M7 33L32 11l25 22"
            stroke={INK}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Rect
            x={26}
            y={38}
            width={12}
            height={16}
            rx={2}
            fill={PINK}
            stroke={INK}
            strokeWidth={2.4}
          />
        </>
      )}
      {kind === 'bin' && (
        <>
          <Path
            d="M14 18h36M26 18v-5h12v5"
            stroke={INK}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17 18l3 38h24l3-38z"
            fill={GREEN}
            stroke={INK}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Path d="M28 27v20M36 27v20" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )}
      {kind === 'receipt' && (
        <>
          <Path
            d="M16 8h32v48l-5-4-5 4-6-4-5 4-6-4-5 4z"
            fill="#fff"
            stroke={INK}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
          <Path
            d="M23 20h18M23 29h18M23 38h11"
            stroke={INK}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}
