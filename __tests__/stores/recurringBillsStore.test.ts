/**
 * QA — recurringBillsStore
 *
 * Covers the fairness / net-contribution math that feeds Settle Up:
 *  - a single logged payment is split across all housemates (not just the payer)
 *  - an explicit per-payment split overrides the default "everyone" split
 *  - balances always net to ~0 so they combine cleanly with one-off bills
 */

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
  },
}));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));

import {
  calculateFairness,
  type RecurringBill,
  type HouseholdPayment,
} from '../../stores/recurringBillsStore';

const bill = (id: string, assignedTo: string): RecurringBill => ({
  id,
  name: `Bill ${id}`,
  assignedTo,
  frequency: 'monthly',
  typicalAmount: 0,
  icon: '🧾',
  createdAt: '2026-01-01T00:00:00Z',
});

const payment = (billId: string, amount: number, splitBetween?: string[]): HouseholdPayment => ({
  id: `p-${billId}-${amount}`,
  billId,
  amount,
  paidAt: '2026-07-01',
  note: '',
  splitBetween,
});

describe('calculateFairness', () => {
  it('splits a single payment across all housemates, not just the payer', () => {
    const bills = [bill('b1', 'alice')];
    const payments = [payment('b1', 777)];
    const result = calculateFairness(bills, payments, ['alice', 'bob', 'carol']);

    const alice = result.find((r) => r.person === 'alice');
    const bob = result.find((r) => r.person === 'bob');
    const carol = result.find((r) => r.person === 'carol');

    // Alice paid 777, her fair share is 259 → she is owed 518.
    expect(alice?.total).toBe(777);
    expect(alice?.balance).toBeCloseTo(518, 5);
    expect(bob?.balance).toBeCloseTo(-259, 5);
    expect(carol?.balance).toBeCloseTo(-259, 5);
  });

  it('nets all balances to ~0 so it combines with one-off bills', () => {
    const bills = [bill('b1', 'alice'), bill('b2', 'bob')];
    const payments = [payment('b1', 300), payment('b2', 150)];
    const result = calculateFairness(bills, payments, ['alice', 'bob', 'carol']);

    const sum = result.reduce((s, r) => s + r.balance, 0);
    expect(sum).toBeCloseTo(0, 5);
  });

  it('honours an explicit per-payment split over the default everyone split', () => {
    const bills = [bill('b1', 'alice')];
    // Only alice and bob share this 100 payment; carol is excluded.
    const payments = [payment('b1', 100, ['alice', 'bob'])];
    const result = calculateFairness(bills, payments, ['alice', 'bob', 'carol']);

    const alice = result.find((r) => r.person === 'alice');
    const bob = result.find((r) => r.person === 'bob');
    const carol = result.find((r) => r.person === 'carol');

    expect(alice?.balance).toBeCloseTo(50, 5); // paid 100, owes 50
    expect(bob?.balance).toBeCloseTo(-50, 5); // owes half
    expect(carol).toBeUndefined(); // not involved, no balance
  });

  it('returns nothing when there are no payments', () => {
    expect(calculateFairness([bill('b1', 'alice')], [], ['alice', 'bob'])).toEqual([]);
  });

  it('falls back to the payer when no members are known', () => {
    const bills = [bill('b1', 'alice')];
    const result = calculateFairness(bills, [payment('b1', 200)], []);
    const alice = result.find((r) => r.person === 'alice');
    // Payer both pays and owes the whole amount → net 0, but still shows the total paid.
    expect(alice?.total).toBe(200);
    expect(alice?.balance).toBeCloseTo(0, 5);
  });
});
