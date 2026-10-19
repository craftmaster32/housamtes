import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { isRTL, type AppLanguage } from '@lib/i18n';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
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
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();
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
      <View style={[styles.row, { backgroundColor: p.paper }]}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.household_covers_previous')}
        >
          <Ionicons
            name={rtl ? 'chevron-forward' : 'chevron-back'}
            size={20}
            color={p.paperMuted}
          />
        </Pressable>
        <View
          style={styles.valueWrap}
          accessible
          accessibilityLabel={`${label}: ${text}`}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.value, headingFont, { color: p.paperInk }]}>{text}</Text>
          {!!caption && (
            <Text style={[styles.caption, handFont, { color: p.hand }]}>{caption}</Text>
          )}
        </View>
        <Pressable
          onPress={goForward}
          style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.household_covers_next')}
        >
          <Ionicons
            name={rtl ? 'chevron-back' : 'chevron-forward'}
            size={20}
            color={p.paperMuted}
          />
        </Pressable>
      </View>
    </View>
  );
}

// The period sits on a strip of notebook paper, with the hint jotted underneath.
const styles = StyleSheet.create({
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(6) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ms(18),
    paddingHorizontal: ms(10),
    paddingVertical: ms(10),
    minHeight: ms(68),
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,32,29,0.06)',
  },
  arrowPressed: { backgroundColor: 'rgba(34,32,29,0.14)' },
  valueWrap: { flex: 1, alignItems: 'center', paddingVertical: ms(2) },
  value: { fontSize: mf(26), letterSpacing: -0.6, lineHeight: mf(31) },
  caption: { fontSize: mf(19), lineHeight: mf(23), marginTop: ms(1) },
});
