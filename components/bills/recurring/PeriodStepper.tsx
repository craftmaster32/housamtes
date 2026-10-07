import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { isRTL, type AppLanguage } from '@lib/i18n';
import { font } from '@constants/typography';
import { formatPeriod, shiftMonth, type CoveragePeriod } from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';
import { useRecurringPalette } from './palette';

interface PeriodStepperProps {
  label: string; // visible field label, also used for screen readers
  value: CoveragePeriod;
  caption?: string; // muted line under the value, e.g. "Next unpaid period"
  onChange: (value: CoveragePeriod) => void;
}

/**
 * "Period covered" stepper: the months a payment pays for, centred between
 * ‹ › buttons that move it one billing period (its own length) at a time.
 */
export function PeriodStepper({
  label,
  value,
  caption,
  onChange,
}: PeriodStepperProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const p = useRecurringPalette();
  const rtl = isRTL(i18n.language as AppLanguage);
  const text = formatPeriod(value, i18n.language);

  const goBack = useCallback(
    (): void => onChange({ ...value, start: shiftMonth(value.start, -value.months) }),
    [onChange, value]
  );
  const goForward = useCallback(
    (): void => onChange({ ...value, start: shiftMonth(value.start, value.months) }),
    [onChange, value]
  );

  return (
    <View>
      <Text style={[styles.label, { color: p.muted }]}>{label}</Text>
      <View style={[styles.row, { borderColor: p.border }]}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.arrow, pressed && { backgroundColor: p.secondaryBg }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.household_covers_previous')}
        >
          <Ionicons name={rtl ? 'chevron-forward' : 'chevron-back'} size={20} color={p.primary} />
        </Pressable>
        <View
          style={styles.valueWrap}
          accessible
          accessibilityLabel={`${label}: ${text}`}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.value, { color: p.text }]}>{text}</Text>
          {!!caption && <Text style={[styles.caption, { color: p.muted }]}>{caption}</Text>}
        </View>
        <Pressable
          onPress={goForward}
          style={({ pressed }) => [styles.arrow, pressed && { backgroundColor: p.secondaryBg }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.household_covers_next')}
        >
          <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={20} color={p.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: mf(13), ...font.medium, marginBottom: ms(6) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: ms(14),
    paddingHorizontal: ms(4),
    minHeight: ms(60),
  },
  arrow: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueWrap: { flex: 1, alignItems: 'center', paddingVertical: ms(8) },
  value: { fontSize: mf(17), ...font.semibold },
  caption: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
});
