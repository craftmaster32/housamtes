import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface BillTab<K extends string> {
  key: K;
  label: string;
  icon?: IoniconName;
}

interface BillTabsProps<K extends string> {
  tabs: BillTab<K>[];
  selected: K;
  onSelect: (key: K) => void;
}

// Plain words with a blue marker stroke under the chosen one — like underlining
// a heading in a notebook, instead of a pill switch.
export function BillTabs<K extends string>({
  tabs,
  selected,
  onSelect,
}: BillTabsProps<K>): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const on = tab.key === selected;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [styles.tab, pressed && !on && styles.pressed]}
            onPress={() => onSelect(tab.key)}
            accessible
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <View style={styles.inner}>
              {tab.icon && (
                <Ionicons name={tab.icon} size={17} color={on ? c.primary : c.textSecondary} />
              )}
              <Text style={[styles.label, { color: on ? c.textPrimary : c.textSecondary }]}>
                {tab.label}
              </Text>
            </View>
            <View style={[styles.marker, { backgroundColor: on ? c.primary : 'transparent' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ms(22) },
  tab: { minHeight: 44, justifyContent: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: ms(7) },
  label: { fontSize: mf(16), ...font.bold },
  // A slightly uneven felt-tip stroke under the selected tab.
  marker: {
    height: ms(5),
    borderRadius: ms(3),
    marginTop: ms(5),
    marginEnd: ms(-3),
    opacity: 0.85,
    transform: [{ rotate: '-0.8deg' }],
  },
  pressed: { opacity: 0.7 },
});
