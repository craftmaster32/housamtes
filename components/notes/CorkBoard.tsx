import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { ms } from '@utils/responsive';

// Cork and its wooden frame stay the same in both themes: it's a real object.
const CORK = '#C9A476';
const FRAME = '#8A6640';
const SPECK_DARK = 'rgba(92,60,25,0.28)';
const SPECK_LIGHT = 'rgba(255,240,215,0.35)';

export type CorkPart = 'top' | 'middle' | 'bottom';

interface CorkBoardProps {
  /** The board is drawn in slices so the notes can live in a FlatList. */
  part: CorkPart;
  children?: React.ReactNode;
  patternId: string;
}

/** One slice of the cork notice board: the frame's top, a middle row, or its bottom. */
export function CorkBoard({ part, children, patternId }: CorkBoardProps): React.JSX.Element {
  return (
    <View style={[styles.base, part === 'top' && styles.top, part === 'bottom' && styles.bottom]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id={patternId} width={18} height={18} patternUnits="userSpaceOnUse">
            <Circle cx={3} cy={4} r={1} fill={SPECK_DARK} />
            <Circle cx={12} cy={2} r={0.8} fill={SPECK_LIGHT} />
            <Circle cx={9} cy={11} r={1.2} fill={SPECK_DARK} />
            <Circle cx={16} cy={14} r={0.9} fill={SPECK_DARK} />
            <Circle cx={4} cy={15} r={0.8} fill={SPECK_LIGHT} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: CORK,
    borderColor: FRAME,
    borderLeftWidth: ms(7),
    borderRightWidth: ms(7),
    paddingHorizontal: ms(14),
    overflow: 'hidden',
  },
  top: {
    borderTopWidth: ms(7),
    borderTopLeftRadius: ms(14),
    borderTopRightRadius: ms(14),
    paddingTop: ms(18),
  },
  bottom: {
    borderBottomWidth: ms(7),
    borderBottomLeftRadius: ms(14),
    borderBottomRightRadius: ms(14),
    paddingBottom: ms(18),
  },
});
