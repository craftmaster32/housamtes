import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { DotLeader } from '@components/shared/DotLeader';
import { mf, ms } from '@utils/responsive';

interface ExpenseLine {
  name: string;
  amount: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}

/** This month's top categories as receipt lines: name, dotted leader, amount. */
export function ExpenseSummary({ lines }: { lines: ExpenseLine[] }): React.JSX.Element {
  const c = useThemedColors();
  const currency = useSettingsStore((s) => s.currency);
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      {lines.map((cat) => (
        <View key={cat.name} style={styles.line}>
          <Ionicons name={cat.icon} size={17} color={cat.color} />
          <Text style={[styles.lineName, { color: c.textPrimary }]}>
            {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
          </Text>
          <DotLeader color={c.border} />
          <Text style={[styles.lineAmt, { color: c.textPrimary }]}>
            {currency}
            {cat.amount.toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ms(18), paddingHorizontal: ms(16), paddingVertical: ms(6) },
  line: { flexDirection: 'row', alignItems: 'center', gap: ms(8), minHeight: 44 },
  lineName: { fontSize: mf(15), ...font.medium },
  lineAmt: { fontSize: mf(15), ...font.semibold },
});
