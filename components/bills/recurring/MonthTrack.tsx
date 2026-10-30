import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { formatMonthShort, type MonthMark } from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';

interface MonthTrackProps {
  track: { month: string; mark: MonthMark }[];
}

// A row of month boxes, ticked off like a paper bill tracker on the fridge:
// a tick when paid, a red ring when late, a dashed box for what's next.
export function MonthTrack({ track }: MonthTrackProps): React.JSX.Element {
  const c = useThemedColors();
  const { i18n } = useTranslation();
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {track.map(({ month, mark }) => {
        const labelColor =
          mark === 'late' ? c.danger : mark === 'next' ? c.primary : c.textTertiary;
        return (
          <View key={month} style={styles.cell}>
            <View
              style={[
                styles.box,
                { borderColor: c.border },
                mark === 'paid' && { backgroundColor: c.successTint, borderColor: 'transparent' },
                mark === 'late' && [styles.late, { borderColor: c.danger }],
                mark === 'next' && [styles.next, { borderColor: c.primary }],
              ]}
            >
              {mark === 'paid' && <Ionicons name="checkmark" size={16} color={c.success} />}
            </View>
            <Text style={[styles.label, { color: labelColor }]}>
              {formatMonthShort(month, i18n.language)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ms(5), marginTop: ms(12) },
  cell: { width: ms(31), alignItems: 'center' },
  box: {
    width: ms(24),
    height: ms(24),
    borderRadius: ms(7),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // A hand-drawn ring rather than a perfect circle.
  late: { borderRadius: ms(12), transform: [{ rotate: '-6deg' }, { scaleX: 1.06 }] },
  next: { borderStyle: 'dashed' },
  label: { fontSize: mf(11), ...font.extrabold, marginTop: ms(3) },
});
