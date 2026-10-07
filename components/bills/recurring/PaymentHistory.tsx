import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { HouseholdPayment } from '@stores/recurringBillsStore';
import { useMemberName } from '@hooks/useMemberName';
import { font } from '@constants/typography';
import { formatDayMonth, formatPeriod, paymentPeriod } from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';
import { formatMoney } from './money';
import { useRecurringPalette } from './palette';

interface PaymentHistoryProps {
  payments: HouseholdPayment[]; // this bill's payments, newest first
  overlapping: Set<string>; // ids of payments whose period is logged twice
  defaultPayer: string; // the bill's assignee, for payments without a recorded payer
  currency: string;
  onSelect: (payment: HouseholdPayment) => void;
}

/** A bill's logged payments, shown inside its card. Tap a row to edit or delete it. */
export function PaymentHistory({
  payments,
  overlapping,
  defaultPayer,
  currency,
  onSelect,
}: PaymentHistoryProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  return (
    <View style={[styles.container, { borderTopColor: p.border }]}>
      <Text style={[styles.heading, { color: p.muted }]}>{t('bills.recurring_history_label')}</Text>
      {payments.map((payment) => (
        <HistoryRow
          key={payment.id}
          payment={payment}
          isDuplicate={overlapping.has(payment.id)}
          defaultPayer={defaultPayer}
          currency={currency}
          onSelect={onSelect}
        />
      ))}
      <Text style={[styles.hint, { color: p.muted }]}>{t('bills.recurring_history_hint')}</Text>
    </View>
  );
}

interface HistoryRowProps {
  payment: HouseholdPayment;
  isDuplicate: boolean;
  defaultPayer: string;
  currency: string;
  onSelect: (payment: HouseholdPayment) => void;
}

function HistoryRow({
  payment,
  isDuplicate,
  defaultPayer,
  currency,
  onSelect,
}: HistoryRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const p = useRecurringPalette();
  const memberName = useMemberName();
  const handlePress = useCallback((): void => onSelect(payment), [onSelect, payment]);

  const period = paymentPeriod(payment);
  const paidOn = t('bills.recurring_paid_on_date', {
    date: formatDayMonth(payment.paidAt, i18n.language),
  });
  // Legacy payments whose months we couldn't read are named by their note.
  const title = period
    ? formatPeriod(period, i18n.language)
    : payment.note || t('bills.recurring_period_not_recorded');
  const subtitle = period ? `${paidOn} · ${memberName(payment.paidBy ?? defaultPayer)}` : paidOn;
  const amount = formatMoney(currency, payment.amount);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: p.secondaryBg }]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={[
        title,
        subtitle,
        amount,
        isDuplicate ? t('bills.recurring_duplicate') : '',
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint={t('bills.recurring_history_hint')}
    >
      <View style={styles.main}>
        <Text style={[styles.title, { color: p.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: p.muted }]} numberOfLines={1}>
          {subtitle}
        </Text>
        {isDuplicate && (
          <View style={[styles.pill, { backgroundColor: p.overdueBg }]}>
            <Text style={[styles.pillText, { color: p.overdueText }]}>
              {t('bills.recurring_duplicate')}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.amount, { color: p.text }]}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, marginTop: ms(14), paddingTop: ms(12) },
  heading: {
    fontSize: mf(12),
    ...font.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: ms(4),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ms(12),
    minHeight: ms(56),
    paddingVertical: ms(10),
    paddingHorizontal: ms(8),
    marginHorizontal: ms(-8),
    borderRadius: ms(12),
  },
  main: { flex: 1, minWidth: 0 },
  title: { fontSize: mf(15), ...font.medium },
  subtitle: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: ms(10),
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    marginTop: ms(6),
  },
  pillText: { fontSize: mf(12), ...font.semibold },
  amount: { fontSize: mf(15), ...font.semibold, writingDirection: 'ltr' },
  hint: { fontSize: mf(12), ...font.regular, marginTop: ms(8), textAlign: 'center' },
});
