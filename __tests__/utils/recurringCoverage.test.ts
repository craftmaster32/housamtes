import {
  coveredThrough,
  findOverlappingPayments,
  formatDayMonth,
  formatMonthYear,
  formatPeriod,
  getDueStatus,
  nextUnpaidPeriod,
  periodsOverlap,
  sortBillsByDue,
} from '@utils/recurringCoverage';
import type { HouseholdPayment, RecurringBill } from '@stores/recurringBillsStore';

const TODAY = '2026-10-07';

const bill = (id: string, frequency: RecurringBill['frequency']): RecurringBill => ({
  id,
  name: id,
  assignedTo: 'alice',
  frequency,
  typicalAmount: 100,
  icon: 'receipt-outline',
  createdAt: '2026-01-01T00:00:00Z',
});

let seq = 0;
const pay = (
  billId: string,
  coverageStart?: string,
  coverageMonths?: number,
  paidAt = '2026-07-01'
): HouseholdPayment => ({
  id: `p${++seq}`,
  billId,
  amount: 100,
  paidAt,
  note: '',
  coverageStart,
  coverageMonths,
});

// ארנונה — every 2 months, paid through Aug; ועד בית — every 3 months, paid through Dec.
const arnona = bill('arnona', 'bimonthly');
const vaad = bill('vaad', 'quarterly');
const payments: HouseholdPayment[] = [
  pay('arnona', '2026-05-01', 2, '2026-05-28'),
  pay('arnona', '2026-07-01', 2, '2026-07-03'),
  pay('vaad', '2026-07-01', 3, '2026-07-05'),
  pay('vaad', '2026-10-01', 3, '2026-10-02'),
];

describe('coveredThrough', () => {
  it('is the last month covered by the latest coverage', () => {
    expect(coveredThrough('arnona', payments)).toBe('2026-08-01');
    expect(coveredThrough('vaad', payments)).toBe('2026-12-01');
  });

  it('ignores payments whose coverage is unknown', () => {
    expect(coveredThrough('x', [pay('x'), pay('x')])).toBeNull();
  });

  it('uses the furthest coverage even when it was logged first', () => {
    const list = [pay('x', '2026-09-01', 1, '2026-09-01'), pay('x', '2026-03-01', 1, '2026-10-01')];
    expect(coveredThrough('x', list)).toBe('2026-09-01');
  });
});

describe('nextUnpaidPeriod', () => {
  it('starts right after coveredThrough and lasts one billing period', () => {
    expect(nextUnpaidPeriod(arnona, payments, TODAY)).toEqual({ start: '2026-09-01', months: 2 });
    expect(nextUnpaidPeriod(vaad, payments, TODAY)).toEqual({ start: '2027-01-01', months: 3 });
  });

  it('starts in the current month for a bill with nothing logged', () => {
    expect(nextUnpaidPeriod(bill('new', 'monthly'), [], TODAY)).toEqual({
      start: '2026-10-01',
      months: 1,
    });
  });
});

describe('getDueStatus', () => {
  it('is overdue from the first day of the unpaid period, whatever the payment date', () => {
    expect(getDueStatus(arnona, payments, TODAY)).toEqual({
      dueDate: '2026-09-01',
      daysUntil: -36,
      isOverdue: true,
      period: { start: '2026-09-01', months: 2 },
    });
  });

  it('counts down to the next period when coverage runs ahead', () => {
    expect(getDueStatus(vaad, payments, TODAY)).toMatchObject({
      dueDate: '2027-01-01',
      daysUntil: 86,
      isOverdue: false,
    });
  });

  it('is null for a bill with no payments and no due date', () => {
    expect(getDueStatus(bill('new', 'monthly'), [], TODAY)).toBeNull();
  });

  it('uses the due date set on the bill until something is paid', () => {
    const b = { ...bill('new', 'monthly'), nextDueDate: '2026-10-15' };
    expect(getDueStatus(b, [], TODAY)).toMatchObject({ dueDate: '2026-10-15', daysUntil: 8 });
  });
});

describe('overlaps', () => {
  it('detects periods that share a month', () => {
    expect(
      periodsOverlap({ start: '2026-07-01', months: 2 }, { start: '2026-08-01', months: 2 })
    ).toBe(true);
    expect(
      periodsOverlap({ start: '2026-07-01', months: 2 }, { start: '2026-09-01', months: 2 })
    ).toBe(false);
  });

  it('flags both payments of the same bill that cover the same period', () => {
    const a = pay('arnona', '2026-07-01', 2);
    const b = pay('arnona', '2026-07-01', 2);
    const other = pay('vaad', '2026-07-01', 3); // different bill — not a duplicate
    const legacy = pay('arnona'); // unknown coverage — never flagged
    const result = findOverlappingPayments([a, b, other, legacy]);
    expect(result.has(a.id)).toBe(true);
    expect(result.has(b.id)).toBe(true);
    expect(result.has(other.id)).toBe(false);
    expect(result.has(legacy.id)).toBe(false);
  });
});

describe('sortBillsByDue', () => {
  it('puts overdue bills first, then the soonest due, then bills with no due date', () => {
    const idle = bill('idle', 'monthly');
    const soon = { ...bill('soon', 'monthly'), nextDueDate: '2026-10-20' };
    const sorted = sortBillsByDue([idle, vaad, soon, arnona], payments, TODAY);
    expect(sorted.map((b) => b.id)).toEqual(['arnona', 'soon', 'vaad', 'idle']);
  });
});

describe('labels', () => {
  it('formats periods with and without the year', () => {
    expect(formatPeriod({ start: '2026-08-01', months: 1 }, 'en')).toBe('Aug 2026');
    expect(formatPeriod({ start: '2026-07-01', months: 2 }, 'en')).toBe('Jul–Aug 2026');
    expect(formatPeriod({ start: '2026-12-01', months: 2 }, 'en')).toBe('Dec 2026–Jan 2027');
    expect(formatPeriod({ start: '2026-09-01', months: 2 }, 'en', { withYear: false })).toBe(
      'Sep–Oct'
    );
  });

  it('formats months and days', () => {
    expect(formatMonthYear('2026-08-01', 'en')).toBe('Aug 2026');
    expect(formatDayMonth('2026-09-01', 'en')).toBe('1 Sep');
  });
});
