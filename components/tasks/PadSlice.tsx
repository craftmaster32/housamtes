import { View, StyleSheet } from 'react-native';
import { useThemedColors } from '@constants/colors';
import { ms } from '@utils/responsive';

interface PadSliceProps {
  children: React.ReactNode;
  isFirst: boolean;
  isLast: boolean;
  /** A dashed rule across the top, between two chores. */
  dashedTop?: boolean;
}

/**
 * One row's share of the to-do pad. Rows sit flush in the list so together they
 * read as one pad of paper with a blue glued edge along the top. The paper stays
 * light in dark mode, like a real pad on a dark table.
 */
export function PadSlice({
  children,
  isFirst,
  isLast,
  dashedTop = false,
}: PadSliceProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View
      style={[
        styles.page,
        { backgroundColor: c.receipt },
        isFirst && styles.first,
        isLast && styles.last,
      ]}
    >
      {isFirst && <View style={[styles.binding, { backgroundColor: c.primary }]} />}
      {dashedTop && (
        // iOS can't dash a single border side, so the rule is drawn as dashes.
        <View style={styles.dashes} pointerEvents="none">
          {Array.from({ length: 48 }, (_, i) => (
            <View key={i} style={[styles.dash, { backgroundColor: c.receiptRule }]} />
          ))}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
  first: { borderTopLeftRadius: ms(4), borderTopRightRadius: ms(4), paddingTop: ms(6) },
  last: { borderBottomLeftRadius: ms(4), borderBottomRightRadius: ms(4), paddingBottom: ms(4) },
  binding: { height: ms(8), opacity: 0.85, marginTop: -ms(6), marginBottom: ms(2) },
  dashes: {
    flexDirection: 'row',
    gap: ms(4),
    height: 1.5,
    overflow: 'hidden',
    marginHorizontal: ms(14),
  },
  dash: { width: ms(5), height: 1.5 },
});
