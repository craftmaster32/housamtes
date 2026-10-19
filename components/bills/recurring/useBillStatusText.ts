import { useTranslation } from 'react-i18next';
import {
  formatDayMonth,
  formatMonthYear,
  formatPeriod,
  type DueStatus,
} from '@utils/recurringCoverage';

export interface BillStatusText {
  /** "Covered through Aug 2026" / coverage unknown / no payments yet. */
  coverage: string;
  /** "Sep–Oct 2026 not paid yet" or "Next due 7 Oct"; empty when nothing is due. */
  line: string;
  /** The one big answer: "36d overdue", "due today", "in 5d"; null when nothing is due. */
  answer: string | null;
  overdue: boolean;
}

/** The words a recurring bill's tile shows about where it stands. */
export function useBillStatusText(
  coveredThrough: string | null,
  status: DueStatus | null,
  hasPayments: boolean
): BillStatusText {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const coverage = coveredThrough
    ? t('bills.recurring_covered_through', { month: formatMonthYear(coveredThrough, lang) })
    : hasPayments
      ? t('bills.recurring_coverage_unknown')
      : t('bills.household_no_payments');
  const line = !status
    ? ''
    : status.isOverdue
      ? t('bills.recurring_not_paid_yet', { period: formatPeriod(status.period, lang) })
      : t('bills.recurring_next_due', { date: formatDayMonth(status.dueDate, lang) });
  const answer = !status
    ? null
    : status.isOverdue
      ? t('bills.recurring_overdue_days', { count: -status.daysUntil })
      : status.daysUntil === 0
        ? t('bills.recurring_due_today')
        : t('bills.recurring_in_days', { count: status.daysUntil });
  return { coverage, line, answer, overdue: status?.isOverdue ?? false };
}
