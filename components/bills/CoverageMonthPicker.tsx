import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  formatCoverage,
  periodMonths,
  shiftMonth,
  type BillFrequency,
} from '@stores/recurringBillsStore';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { toAppLocale } from '@utils/dates';
import { ms } from '@utils/responsive';

interface CoverageMonthPickerProps {
  value: string; // YYYY-MM-01 — first covered month
  frequency: BillFrequency;
  onChange: (value: string) => void;
}

/**
 * "Covers" stepper for a recurring-bill payment: shows the month(s) the payment
 * pays for (e.g. "Sep – Oct 2026" for a bimonthly bill) with ‹ › buttons that
 * move the period one billing cycle at a time.
 */
export function CoverageMonthPicker({
  value,
  frequency,
  onChange,
}: CoverageMonthPickerProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const months = periodMonths(value, frequency);
  const label = formatCoverage(months, toAppLocale(i18n.language));
  const step = months.length;

  const goBack = useCallback(
    (): void => onChange(shiftMonth(value, -step)),
    [onChange, value, step]
  );
  const goForward = useCallback(
    (): void => onChange(shiftMonth(value, step)),
    [onChange, value, step]
  );

  return (
    <View style={[styles.row, { backgroundColor: c.background, borderColor: c.border }]}>
      <Pressable
        onPress={goBack}
        style={styles.arrow}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('bills.household_covers_previous')}
      >
        <Ionicons name="chevron-back" size={18} color={c.primary} />
      </Pressable>
      <Text
        style={[styles.label, { color: c.textPrimary }]}
        accessibilityLabel={`${t('bills.household_covers')}: ${label}`}
        accessibilityLiveRegion="polite"
      >
        {label}
      </Text>
      <Pressable
        onPress={goForward}
        style={styles.arrow}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('bills.household_covers_next')}
      >
        <Ionicons name="chevron-forward" size={18} color={c.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: sizes.borderRadiusSm,
  },
  arrow: { width: ms(44), height: ms(44), alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, textAlign: 'center', fontSize: sizes.fontSm, ...font.semibold },
});
