import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

interface DayHeadingProps {
  label: string;
}

/** A day written by hand between two dashed lines: "– – – Today – – –". */
export function DayHeading({ label }: DayHeadingProps): React.JSX.Element {
  const c = useThemedColors();
  const hand = useHandFont();
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={[styles.rule, { borderColor: c.border }]} />
      <Text style={[styles.label, hand, { color: c.textSecondary }]}>{label}</Text>
      <View style={[styles.rule, { borderColor: c.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(10), marginVertical: ms(8) },
  rule: { flex: 1, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  label: { fontSize: mf(21) },
});
