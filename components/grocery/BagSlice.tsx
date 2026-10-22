import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useThemedColors } from '@constants/colors';
import { ms } from '@utils/responsive';

const TOOTH = ms(12);
const TEETH = Array.from({ length: 40 });

interface BagSliceProps {
  children?: React.ReactNode;
  /** The bag's opening: zig-zag cut and a folded band along the top. */
  isTop?: boolean;
  /** The bag's bottom: rounded corners. */
  isBottom?: boolean;
  /** A dashed rule across the top, between two items. */
  dashedTop?: boolean;
}

/**
 * One row's share of the brown paper grocery bag. Rows sit flush in the list so
 * together they read as one bag. The paper stays light in dark mode, like a real
 * bag on a dark table.
 */
export function BagSlice({
  children,
  isTop = false,
  isBottom = false,
  dashedTop = false,
}: BagSliceProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View
      style={[
        styles.page,
        { backgroundColor: c.kraft },
        isTop && styles.top,
        isBottom && styles.bottom,
      ]}
    >
      {/* Soft shading down both sides, like a bag's folded edges. */}
      <View style={[styles.side, styles.sideStart]} pointerEvents="none" />
      <View style={[styles.side, styles.sideEnd]} pointerEvents="none" />
      {isTop && (
        <>
          <View style={styles.teeth} pointerEvents="none">
            {TEETH.map((_, i) => (
              <Svg key={i} width={TOOTH} height={TOOTH / 2} viewBox="0 0 12 6">
                <Path d="M0 6 L6 0 L12 6 Z" fill={c.kraft} />
              </Svg>
            ))}
          </View>
          <View style={[styles.fold, { borderBottomColor: c.kraftRule }]} pointerEvents="none" />
        </>
      )}
      {dashedTop && (
        // iOS can't dash a single border side, so the rule is drawn as dashes.
        <View style={styles.dashes} pointerEvents="none">
          {TEETH.map((_, i) => (
            <View key={i} style={[styles.dash, { backgroundColor: c.kraftRule }]} />
          ))}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: ms(14) },
  top: { marginTop: ms(10), paddingTop: ms(26), borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  bottom: {
    paddingBottom: ms(14),
    borderBottomLeftRadius: ms(12),
    borderBottomRightRadius: ms(12),
  },
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: ms(14),
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  sideStart: { start: 0 },
  sideEnd: { end: 0 },
  teeth: {
    position: 'absolute',
    top: -TOOTH / 2 + 0.5,
    left: 0,
    right: 0,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fold: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ms(18),
    backgroundColor: 'rgba(120,85,40,0.12)',
    borderBottomWidth: 1.5,
  },
  dashes: { flexDirection: 'row', gap: ms(4), height: 1.5, overflow: 'hidden' },
  dash: { width: ms(5), height: 1.5 },
});
