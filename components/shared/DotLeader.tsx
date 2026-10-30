import { View, StyleSheet } from 'react-native';
import { ms } from '@utils/responsive';

const DOTS = Array.from({ length: 60 });

interface DotLeaderProps {
  color: string;
}

// The dotted line a printed receipt runs from a name to its price. Drawn as
// dots because iOS can't dash or dot a single border side.
export function DotLeader({ color }: DotLeaderProps): React.JSX.Element {
  return (
    <View style={styles.row} pointerEvents="none" accessibilityElementsHidden>
      {DOTS.map((_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    minWidth: ms(12),
    flexDirection: 'row',
    gap: ms(3),
    overflow: 'hidden',
    alignSelf: 'flex-end',
    marginBottom: ms(5),
    marginHorizontal: ms(6),
  },
  dot: { width: 2, height: 2, borderRadius: 1 },
});
