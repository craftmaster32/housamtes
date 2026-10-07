import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { BillFrequency, HouseholdPayment, RecurringBill } from '@stores/recurringBillsStore';
import { getDateFnsLocale } from '@utils/dates';

/**
 * Which months a recurring-bill payment pays for, and what that means for the
 * bill: how far it's covered, what's next to pay, and whether it's overdue.
 * Everything here is derived from payments' coverage — never stored.
 */

/** A run of whole months: `start` is the first month (YYYY-MM-01). */
export interface CoveragePeriod {
  start: string;
  months: number;
}

export const FREQUENCY_MONTHS: Record<BillFrequency, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
};

/** First day of the month a date falls in: "2026-09-24" → "2026-09-01". */
export function monthStart(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

/** Shift a YYYY-MM-01 month by `n` months (negative goes back). */
export function shiftMonth(monthStr: string, n: number): string {
  return format(addMonths(parseISO(monthStr), n), 'yyyy-MM-01');
}

/** Today's local date as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/** Every month in a period, as YYYY-MM-01 strings. */
export function periodMonths(period: CoveragePeriod): string[] {
  return Array.from({ length: Math.max(1, period.months) }, (_, i) => shiftMonth(period.start, i));
}

/** The last month a period covers (YYYY-MM-01). */
export function periodEnd(period: CoveragePeriod): string {
  return shiftMonth(period.start, Math.max(1, period.months) - 1);
}

/** The period a payment covers, or null for legacy payments with unknown coverage. */
export function paymentPeriod(payment: HouseholdPayment): CoveragePeriod | null {
  if (!payment.coverageStart || !payment.coverageMonths) return null;
  return { start: payment.coverageStart, months: payment.coverageMonths };
}

/** True when two periods share at least one month. */
export function periodsOverlap(a: CoveragePeriod, b: CoveragePeriod): boolean {
  // YYYY-MM-01 strings sort chronologically, so plain string comparison works.
  return a.start <= periodEnd(b) && b.start <= periodEnd(a);
}

/** The last month covered by any of the bill's payments, or null if none has coverage. */
export function coveredThrough(billId: string, payments: HouseholdPayment[]): string | null {
  let latest: string | null = null;
  for (const p of payments) {
    if (p.billId !== billId) continue;
    const period = paymentPeriod(p);
    if (!period) continue;
    const end = periodEnd(period);
    if (!latest || end > latest) latest = end;
  }
  return latest;
}

/**
 * When a bill with no structured coverage is next due: one billing period after
 * its latest payment (legacy notes we couldn't read), or the due date set when
 * the bill was created. Null when there's nothing to go on.
 */
function fallbackDueDate(bill: RecurringBill, payments: HouseholdPayment[]): string | null {
  const last = payments
    .filter((p) => p.billId === bill.id)
    .reduce<string | null>((acc, p) => (!acc || p.paidAt > acc ? p.paidAt : acc), null);
  if (last) {
    return format(addMonths(parseISO(last), FREQUENCY_MONTHS[bill.frequency]), 'yyyy-MM-dd');
  }
  return bill.nextDueDate ?? null;
}

/**
 * The period right after `coveredThrough`, one billing cycle long. Without any
 * coverage it starts at the fallback due month, or the current month.
 */
export function nextUnpaidPeriod(
  bill: RecurringBill,
  payments: HouseholdPayment[],
  today: string
): CoveragePeriod {
  const months = FREQUENCY_MONTHS[bill.frequency];
  const through = coveredThrough(bill.id, payments);
  if (through) return { start: shiftMonth(through, 1), months };
  const due = fallbackDueDate(bill, payments);
  return { start: monthStart(due ?? today), months };
}

export interface DueStatus {
  dueDate: string; // YYYY-MM-DD
  daysUntil: number; // negative when overdue
  isOverdue: boolean;
  period: CoveragePeriod; // the next unpaid period
}

/**
 * Due status from coverage, not from when payments were made: the next unpaid
 * period is due on its first day. Null for a bill with no payments and no due
 * date set — there's nothing to be late for yet.
 */
export function getDueStatus(
  bill: RecurringBill,
  payments: HouseholdPayment[],
  today: string
): DueStatus | null {
  const period = nextUnpaidPeriod(bill, payments, today);
  const dueDate = coveredThrough(bill.id, payments)
    ? period.start
    : fallbackDueDate(bill, payments);
  if (!dueDate) return null;
  const daysUntil = differenceInCalendarDays(parseISO(dueDate), parseISO(today));
  return { dueDate, daysUntil, isOverdue: daysUntil < 0, period };
}

/** Ids of payments whose period overlaps another payment of the same bill. */
export function findOverlappingPayments(payments: HouseholdPayment[]): Set<string> {
  const overlapping = new Set<string>();
  const withPeriod = payments
    .map((p) => ({ p, period: paymentPeriod(p) }))
    .filter((x): x is { p: HouseholdPayment; period: CoveragePeriod } => x.period !== null);
  for (let i = 0; i < withPeriod.length; i++) {
    for (let j = i + 1; j < withPeriod.length; j++) {
      const a = withPeriod[i];
      const b = withPeriod[j];
      if (a.p.billId === b.p.billId && periodsOverlap(a.period, b.period)) {
        overlapping.add(a.p.id);
        overlapping.add(b.p.id);
      }
    }
  }
  return overlapping;
}

/** Overdue bills first, then soonest due; bills with no due date go last. */
export function sortBillsByDue(
  bills: RecurringBill[],
  payments: HouseholdPayment[],
  today: string
): RecurringBill[] {
  const due = new Map(bills.map((b) => [b.id, getDueStatus(b, payments, today)?.dueDate ?? null]));
  return [...bills].sort((a, b) => {
    const da = due.get(a.id) ?? null;
    const db = due.get(b.id) ?? null;
    if (da === db) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da.localeCompare(db);
  });
}

// ── Labels ────────────────────────────────────────────────────────────────────

/** "Aug 2026" for a YYYY-MM-01 month, in the app language. */
export function formatMonthYear(month: string, language: string): string {
  return format(parseISO(month), 'MMM yyyy', { locale: getDateFnsLocale(language) });
}

/** "7 Oct" for a YYYY-MM-DD date, in the app language. */
export function formatDayMonth(date: string, language: string): string {
  return format(parseISO(date), 'd MMM', { locale: getDateFnsLocale(language) });
}

/**
 * A period as text: "Aug 2026", "Jul–Aug 2026", or "Dec 2026–Jan 2027" across a
 * year. With `withYear: false` the year is dropped ("Sep–Oct") — for buttons.
 */
export function formatPeriod(
  period: CoveragePeriod,
  language: string,
  { withYear = true }: { withYear?: boolean } = {}
): string {
  const locale = getDateFnsLocale(language);
  const first = parseISO(period.start);
  const last = parseISO(periodEnd(period));
  const month = (d: Date): string => format(d, 'MMM', { locale });
  const monthYear = (d: Date): string => format(d, 'MMM yyyy', { locale });
  if (period.months <= 1) return withYear ? monthYear(first) : month(first);
  if (!withYear) return `${month(first)}–${month(last)}`;
  return first.getFullYear() === last.getFullYear()
    ? `${month(first)}–${monthYear(last)}`
    : `${monthYear(first)}–${monthYear(last)}`;
}
