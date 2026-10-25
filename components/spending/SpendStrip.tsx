import { View, StyleSheet } from 'react-native';
import { type CategoryRowItem } from '@components/spending/spendingFormat';
import { ms } from '@utils/responsive';

interface SpendStripProps {
  rows: CategoryRowItem[];
}

/** The month as one strip: each category's colour, as wide as its share. */
export function SpendStrip({ rows }: SpendStripProps): React.JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <View style={styles.strip} accessible={false} importantForAccessibility="no-hide-descendants">
      {rows.map((r) => (
        <View
          key={r.cat.name}
          style={[styles.part, { flexGrow: r.cat.amount, backgroundColor: r.cat.color }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    height: ms(12),
    borderRadius: ms(6),
    overflow: 'hidden',
    marginTop: ms(4),
    marginBottom: ms(6),
  },
  part: { flexBasis: 0, height: '100%', opacity: 0.75 },
});
