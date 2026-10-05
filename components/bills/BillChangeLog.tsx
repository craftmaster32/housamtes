import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { formatCoverage, periodMonths, type BillFrequency } from '@stores/recurringBillsStore';
import { useMemberName } from '@hooks/useMemberName';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { formatDateDDMMYYYY, toAppLocale } from '@utils/dates';
import type { HistoryChange, HistoryItem } from '@utils/recurringHistory';
import { ms } from '@utils/responsive';

interface BillChangeLogProps {
  items: HistoryItem[]; // newest first, all for one bill
  frequency: BillFrequency;
  currency: string;
}

/**
 * A bill's change history: every edit or deletion of the bill and its payments,
 * with who made it and when, so changes anyone in the house makes stay visible.
 */
export function BillChangeLog({
  items,
  frequency,
  currency,
}: BillChangeLogProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const memberName = useMemberName();
  const locale = toAppLocale(i18n.language);

  const period = useCallback(
    (month: string): string =>
      month ? formatCoverage(periodMonths(month, frequency), locale) : '',
    [frequency, locale]
  );
  const people = useCallback(
    (ids: string[]): string =>
      ids.length === 0 ? t('bills.history_everyone') : ids.map((id) => memberName(id)).join(', '),
    [memberName, t]
  );

  const describeChange = useCallback(
    (change: HistoryChange): string => {
      const money = (n: number): string => `${currency}${n.toFixed(0)}`;
      const text = (s: string): string => (s ? `“${s}”` : '—');
      switch (change.field) {
        case 'amount':
          return t('bills.history_change_amount', {
            from: money(change.from),
            to: money(change.to),
          });
        case 'typicalAmount':
          return t('bills.history_change_typical', {
            from: money(change.from),
            to: money(change.to),
          });
        case 'paidAt':
          return t('bills.history_change_paid_at', {
            from: formatDateDDMMYYYY(change.from),
            to: formatDateDDMMYYYY(change.to),
          });
        case 'coversFrom':
          return t('bills.history_change_covers', {
            from: period(change.from),
            to: period(change.to),
          });
        case 'note':
          return t('bills.history_change_note', { from: text(change.from), to: text(change.to) });
        case 'split':
          return t('bills.history_change_split', {
            from: people(change.from),
            to: people(change.to),
          });
        case 'name':
          return t('bills.history_change_name', { from: change.from, to: change.to });
        case 'assignedTo':
          return t('bills.history_change_payer', {
            from: memberName(change.from),
            to: memberName(change.to),
          });
        case 'frequency':
          return t('bills.history_change_frequency', {
            from: t(`bills.freq_${change.from}`),
            to: t(`bills.freq_${change.to}`),
          });
      }
    },
    [currency, memberName, people, period, t]
  );

  const summary = useCallback(
    (item: HistoryItem): string => {
      if (item.kind === 'payment_delete' && item.payment) {
        return t('bills.history_payment_deleted', {
          amount: `${currency}${item.payment.amount.toFixed(0)}`,
          period: period(item.payment.coversFrom),
        });
      }
      if (item.kind === 'payment_edit' && item.payment) {
        return t('bills.history_payment_edited', { period: period(item.payment.coversFrom) });
      }
      return t('bills.history_bill_edited');
    },
    [currency, period, t]
  );

  return (
    <View style={[styles.container, { borderTopColor: c.border }]}>
      <Text style={[styles.title, { color: c.textSecondary }]}>{t('bills.history_title')}</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={[styles.meta, { color: c.textSecondary }]}>
            {item.actorId ? memberName(item.actorId) : t('bills.history_someone')} ·{' '}
            {format(parseISO(item.at), 'dd/MM/yyyy HH:mm')}
          </Text>
          <Text style={[styles.summary, { color: c.textPrimary }]}>{summary(item)}</Text>
          {item.changes.map((change) => (
            <Text key={change.field} style={[styles.change, { color: c.textSecondary }]}>
              • {describeChange(change)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingTop: sizes.sm, gap: sizes.sm },
  title: {
    fontSize: sizes.fontXs,
    ...font.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  item: { gap: ms(2) },
  meta: { fontSize: sizes.fontXs },
  summary: { fontSize: sizes.fontSm, ...font.semibold },
  change: { fontSize: sizes.fontSm },
});
