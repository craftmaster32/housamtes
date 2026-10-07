import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { font } from '@constants/typography';
import {
  formatDayMonth,
  formatMonthYear,
  formatPeriod,
  type DueStatus,
} from '@utils/recurringCoverage';
import { mf, ms } from '@utils/responsive';
import { useRecurringPalette } from './palette';

interface BillStatusRowProps {
  coveredThrough: string | null; // last covered month (YYYY-MM-01)
  status: DueStatus | null;
  hasPayments: boolean;
}

/** "Covered through Aug 2026 / Sep–Oct 2026 not paid yet" with an "in 5d" / "36d overdue" pill. */
export function BillStatusRow({
  coveredThrough,
  status,
  hasPayments,
}: BillStatusRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const p = useRecurringPalette();
  const lang = i18n.language;

  const title = coveredThrough
    ? t('bills.recurring_covered_through', { month: formatMonthYear(coveredThrough, lang) })
    : hasPayments
      ? t('bills.recurring_coverage_unknown')
      : t('bills.household_no_payments');
  const line = !status
    ? ''
    : status.isOverdue
      ? t('bills.recurring_not_paid_yet', { period: formatPeriod(status.period, lang) })
      : t('bills.recurring_next_due', { date: formatDayMonth(status.dueDate, lang) });
  const badge = !status
    ? null
    : status.isOverdue
      ? t('bills.recurring_overdue_days', { n: -status.daysUntil })
      : status.daysUntil === 0
        ? t('bills.recurring_due_today')
        : t('bills.recurring_in_days', { n: status.daysUntil });
  const overdue = status?.isOverdue ?? false;

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[styles.title, { color: p.text }]}>{title}</Text>
        {!!line && <Text style={[styles.line, { color: p.muted }]}>{line}</Text>}
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: overdue ? p.overdueBg : p.neutralPillBg }]}>
          <Text style={[styles.badgeText, { color: overdue ? p.overdueText : p.neutralPillText }]}>
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(12), marginTop: ms(16) },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: mf(15), ...font.medium },
  line: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
  badge: { borderRadius: ms(12), paddingHorizontal: ms(10), paddingVertical: ms(4) },
  badgeText: { fontSize: mf(13), ...font.semibold },
});
