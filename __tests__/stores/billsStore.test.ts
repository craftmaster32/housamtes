/**
 * QA — billsStore
 *
 * Covers:
 *  1. Pure logic: getPersonShare, calculateAllNetBalances, settleDebts, calculateBalances
 *  2. Store actions: error handling, optimistic updates, race-condition edge cases
 *
 * BUGS PROVEN HERE (marked ⚠️):
 *  ⚠️  getPersonShare returns Infinity when splitBetween is empty (0-member split)
 *  ⚠️  settleBill silently skips notification when bill is deleted mid-flight
 *  ⚠️  settleBill has no guard against settling an already-settled bill
 */

import {
  getPersonShare,
  calculateAllNetBalances,
  calculateBalances,
  calculateSimplifiedBalancesForUser,
  settleDebts,
  useBillsStore,
  type Bill,
} from '../../stores/billsStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}));

jest.mock('@lib/notifyHousemates', () => ({ notifyHousemates: jest.fn() }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('@stores/settingsStore', () => ({
  useSettingsStore: { getState: (): { currency: string } => ({ currency: '$' }) },
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: { getState: (): { houseId: string } => ({ houseId: 'house-1' }) },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'b1',
    title: 'Rent',
    amount: 900,
    paidBy: 'Alice',
    splitBetween: ['Alice', 'Bob', 'Carol'],
    splitAmounts: null,
    category: 'Rent',
    date: '2026-04-01',
    createdAt: '2026-04-01T00:00:00Z',
    settled: false,
    settledBy: null,
    settledAt: null,
    notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  useBillsStore.setState({ bills: [], isLoading: false, error: null });
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. getPersonShare
// ─────────────────────────────────────────────────────────────────────────────

describe('getPersonShare', () => {
  it('returns the custom amount from splitAmounts when set', () => {
    const b = bill({ splitAmounts: { Bob: 250, Carol: 350 }, amount: 600 });
    expect(getPersonShare(b, 'Bob')).toBe(250);
    expect(getPersonShare(b, 'Carol')).toBe(350);
  });

  it('divides amount equally when splitAmounts is null', () => {
    const b = bill({ amount: 300, splitBetween: ['Alice', 'Bob', 'Carol'] });
    expect(getPersonShare(b, 'Bob')).toBeCloseTo(100);
  });

  it('returns 0 when splitBetween is empty (division-by-zero guard)', () => {
    // Guard added: splitBetween.length === 0 returns 0 instead of Infinity.
    const b = bill({ amount: 100, splitBetween: [] });
    expect(getPersonShare(b, 'Alice')).toBe(0);
  });

  it('floating-point: share floors to whole cents; payer absorbs the remainder', () => {
    // 10 / 3: each person pays $3.33 (floored to whole cents via Math.floor on cents).
    // The payer keeps the leftover penny — 3 × $3.33 = $9.99, not $10.00.
    const b = bill({ amount: 10, splitBetween: ['Alice', 'Bob', 'Carol'] });
    const share = getPersonShare(b, 'Bob');
    expect(share).toBe(3.33);
    expect(share * b.splitBetween.length).toBeLessThan(b.amount);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. calculateAllNetBalances
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateAllNetBalances', () => {
  it('returns empty map when there are no bills', () => {
    expect(calculateAllNetBalances([])).toEqual(new Map());
  });

  it('skips settled bills', () => {
    const b = bill({ settled: true });
    expect(calculateAllNetBalances([b]).size).toBe(0);
  });

  it('skips bills with empty splitBetween', () => {
    const b = bill({ splitBetween: [] });
    expect(calculateAllNetBalances([b]).size).toBe(0);
  });

  it('does not create a self-debt when paidBy is in splitBetween', () => {
    // Alice paid. Alice is also in the split.
    // Only Bob and Carol owe Alice — Alice should not owe herself.
    const b = bill({ paidBy: 'Alice', amount: 300, splitBetween: ['Alice', 'Bob', 'Carol'] });
    const net = calculateAllNetBalances([b]);
    expect(net.get('Alice')).toBeCloseTo(200); // Bob 100 + Carol 100
    expect(net.get('Bob')).toBeCloseTo(-100);
    expect(net.get('Carol')).toBeCloseTo(-100);
  });

  it('correctly nets balances across multiple bills between the same pair', () => {
    const b1 = bill({ id: 'b1', paidBy: 'Alice', amount: 200, splitBetween: ['Alice', 'Bob'] });
    const b2 = bill({ id: 'b2', paidBy: 'Bob', amount: 100, splitBetween: ['Alice', 'Bob'] });
    // b1: Bob owes Alice 100. b2: Alice owes Bob 50. Net: Bob owes Alice 50.
    const net = calculateAllNetBalances([b1, b2]);
    expect(net.get('Alice')).toBeCloseTo(50);
    expect(net.get('Bob')).toBeCloseTo(-50);
  });

  it('handles custom splitAmounts correctly', () => {
    const b = bill({
      amount: 100,
      splitBetween: ['Alice', 'Bob', 'Carol'],
      splitAmounts: { Bob: 60, Carol: 40 },
    });
    const net = calculateAllNetBalances([b]);
    // Alice paid 100, Bob owes 60, Carol owes 40
    expect(net.get('Alice')).toBeCloseTo(100);
    expect(net.get('Bob')).toBeCloseTo(-60);
    expect(net.get('Carol')).toBeCloseTo(-40);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. settleDebts
// ─────────────────────────────────────────────────────────────────────────────

describe('settleDebts', () => {
  it('returns no transfers when everyone is balanced', () => {
    const net = new Map([['Alice', 0], ['Bob', 0]]);
    expect(settleDebts(net)).toHaveLength(0);
  });

  it('ignores balances within the ±0.01 rounding threshold', () => {
    // Floating-point residue from 10/3 splits must not create phantom debts.
    const net = new Map([['Alice', 0.005], ['Bob', -0.005]]);
    expect(settleDebts(net)).toHaveLength(0);
  });

  it('generates one transfer for a simple two-person debt', () => {
    const net = new Map([['Alice', 100], ['Bob', -100]]);
    const result = settleDebts(net);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ from: 'Bob', to: 'Alice', amount: 100 });
  });

  it('generates two transfers for a three-person imbalance', () => {
    // Alice is owed 200; Bob owes 100; Carol owes 100
    const net = new Map([['Alice', 200], ['Bob', -100], ['Carol', -100]]);
    const result = settleDebts(net);
    expect(result).toHaveLength(2);
    const totalPaid = result.reduce((s, t) => s + t.amount, 0);
    expect(totalPaid).toBeCloseTo(200);
  });

  it('handles a chain where one creditor is covered by multiple debtors', () => {
    const net = new Map([['Alice', 150], ['Bob', -100], ['Carol', -50]]);
    const result = settleDebts(net);
    const toAlice = result.filter((t) => t.to === 'Alice').reduce((s, t) => s + t.amount, 0);
    expect(toAlice).toBeCloseTo(150);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. calculateBalances (current-user view)
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateBalances', () => {
  it('returns empty array with no bills', () => {
    expect(calculateBalances([], 'Alice')).toHaveLength(0);
  });

  it('excludes settled bills', () => {
    const b = bill({ settled: true, paidBy: 'Alice', splitBetween: ['Alice', 'Bob'] });
    expect(calculateBalances([b], 'Alice')).toHaveLength(0);
  });

  it('positive amount means the other person owes me (I paid)', () => {
    const b = bill({ paidBy: 'Alice', amount: 200, splitBetween: ['Alice', 'Bob'] });
    const balances = calculateBalances([b], 'Alice');
    expect(balances).toHaveLength(1);
    expect(balances[0]).toMatchObject({ person: 'Bob', amount: 100 });
  });

  it('negative amount means I owe the other person (they paid)', () => {
    const b = bill({ paidBy: 'Bob', amount: 200, splitBetween: ['Alice', 'Bob'] });
    const balances = calculateBalances([b], 'Alice');
    expect(balances).toHaveLength(1);
    expect(balances[0]).toMatchObject({ person: 'Bob', amount: -100 });
  });

  it('nets two opposing bills between the same pair correctly', () => {
    const b1 = bill({ id: 'b1', paidBy: 'Alice', amount: 300, splitBetween: ['Alice', 'Bob'] }); // Bob owes Alice 150
    const b2 = bill({ id: 'b2', paidBy: 'Bob',   amount: 100, splitBetween: ['Alice', 'Bob'] }); // Alice owes Bob  50
    const balances = calculateBalances([b1, b2], 'Alice');
    expect(balances).toHaveLength(1);
    expect(balances[0]).toMatchObject({ person: 'Bob', amount: 100 }); // net
  });

  it('filters out near-zero residue (< 0.01) after netting', () => {
    // If two bills perfectly cancel out, no entry should appear.
    const b1 = bill({ id: 'b1', paidBy: 'Alice', amount: 100, splitBetween: ['Alice', 'Bob'] });
    const b2 = bill({ id: 'b2', paidBy: 'Bob',   amount: 100, splitBetween: ['Alice', 'Bob'] });
    expect(calculateBalances([b1, b2], 'Alice')).toHaveLength(0);
  });

  it('shows no balance when current user is not involved in the bill', () => {
    // Carol's bill; Alice is not in splitBetween
    const b = bill({ paidBy: 'Carol', splitBetween: ['Carol', 'Bob'] });
    expect(calculateBalances([b], 'Alice')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. calculateSimplifiedBalancesForUser
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateSimplifiedBalancesForUser', () => {
  it('returns empty array when net map is empty', () => {
    expect(calculateSimplifiedBalancesForUser(new Map(), 'Lior')).toHaveLength(0);
  });

  it('returns empty array when current user has no settlements', () => {
    // Alice and Bob owe each other; Lior is uninvolved
    const net = new Map([['Alice', 50], ['Bob', -50]]);
    expect(calculateSimplifiedBalancesForUser(net, 'Lior')).toHaveLength(0);
  });

  it('positive amount — other person owes me', () => {
    const net = new Map([['Lior', 100], ['Bob', -100]]);
    const result = calculateSimplifiedBalancesForUser(net, 'Lior');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ person: 'Bob', amount: 100 });
  });

  it('negative amount — I owe the other person', () => {
    const net = new Map([['Alice', 100], ['Lior', -100]]);
    const result = calculateSimplifiedBalancesForUser(net, 'Lior');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ person: 'Alice', amount: -100 });
  });

  it('simplifies chain debt — intermediate person drops out', () => {
    // Alice owes Bob $100, Bob owes Lior $100.
    // Global net: Alice -100, Bob 0, Lior +100.
    // Splitwise result: Alice pays Lior directly (1 transfer, not 2).
    const net = new Map([['Lior', 100], ['Bob', 0], ['Alice', -100]]);
    const result = calculateSimplifiedBalancesForUser(net, 'Lior');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ person: 'Alice', amount: 100 });
  });

  it('splits owed amount across multiple debtors when needed', () => {
    // Alice owes Lior 60, Bob owes Lior 40
    const net = new Map([['Lior', 100], ['Alice', -60], ['Bob', -40]]);
    const result = calculateSimplifiedBalancesForUser(net, 'Lior');
    const total = result.reduce((s, b) => s + b.amount, 0);
    expect(total).toBeCloseTo(100);
    expect(result.every((b) => b.amount > 0)).toBe(true);
  });

  it('does not mutate the input net map', () => {
    const net = new Map([['Lior', 50], ['Alice', -50]]);
    const copy = new Map(net);
    calculateSimplifiedBalancesForUser(net, 'Lior');
    expect(net).toEqual(copy);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Store actions — DB error handling and race conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('billsStore — settleBill', () => {
  it('throws and does NOT update state when the DB call fails', async () => {
    useBillsStore.setState({ bills: [bill({ id: 'b1', settled: false })] });
    mockFrom.mockReturnValue(fail('network timeout'));

    await expect(
      useBillsStore.getState().settleBill('b1', 'uuid-alice', 'Alice', 'house-1')
    ).rejects.toThrow('Could not settle the bill. Please try again.');

    expect(useBillsStore.getState().bills[0].settled).toBe(false);
  });

  it('marks bill settled and records settledBy on success', async () => {
    useBillsStore.setState({ bills: [bill({ id: 'b1', settled: false })] });
    mockFrom.mockReturnValue(ok());

    await useBillsStore.getState().settleBill('b1', 'uuid-alice', 'Alice', 'house-1');

    const updated = useBillsStore.getState().bills[0];
    expect(updated.settled).toBe(true);
    expect(updated.settledBy).toBe('uuid-alice');
  });

  it('throws "already settled" when trying to settle a bill that is already settled', async () => {
    // Guard added: read bill before DB call; throw if bill.settled is true.
    useBillsStore.setState({ bills: [bill({ id: 'b1', settled: true, settledBy: 'Bob' })] });

    await expect(
      useBillsStore.getState().settleBill('b1', 'uuid-carol', 'Carol', 'house-1')
    ).rejects.toThrow('Bill is already settled');

    expect(useBillsStore.getState().bills[0].settledBy).toBe('Bob'); // unchanged
  });

  it('throws "Bill not found" when id does not exist in state', async () => {
    // Moving bill read to before the DB call means unknown IDs fail immediately.
    useBillsStore.setState({ bills: [] });

    await expect(
      useBillsStore.getState().settleBill('missing-id', 'uuid-alice', 'Alice', 'house-1')
    ).rejects.toThrow('Bill not found');

    expect(mockFrom).not.toHaveBeenCalled(); // never reaches DB
  });

  it('always sends notification — bill captured before DB call so realtime deletions cannot drop it', async () => {
    // Fix: bill is read from state at the START of settleBill, before the DB
    // await. A realtime deletion that fires during the await cannot drop the
    // notification because the local variable is already populated.
    useBillsStore.setState({ bills: [bill({ id: 'b1', settled: false, title: 'Rent' })] });
    mockFrom.mockReturnValue(ok());

    const { notifyHousemates } = jest.requireMock('@lib/notifyHousemates');
    await useBillsStore.getState().settleBill('b1', 'uuid-alice', 'Alice', 'house-1');

    expect(notifyHousemates).toHaveBeenCalledTimes(1);
    expect(notifyHousemates).toHaveBeenCalledWith(expect.objectContaining({ title: '✅ Bill settled' }));
  });
});

describe('billsStore — deleteBill', () => {
  it('throws and keeps bill in state when DB delete fails', async () => {
    useBillsStore.setState({ bills: [bill({ id: 'b1' })] });
    mockFrom.mockReturnValue(fail('RLS violation'));

    await expect(
      useBillsStore.getState().deleteBill('b1', 'house1')
    ).rejects.toThrow('Could not delete the bill. Please try again.');

    expect(useBillsStore.getState().bills).toHaveLength(1);
  });

  it('removes bill from state on success', async () => {
    useBillsStore.setState({ bills: [bill({ id: 'b1' })] });
    mockFrom.mockReturnValue(ok());

    await useBillsStore.getState().deleteBill('b1', 'house1');

    expect(useBillsStore.getState().bills).toHaveLength(0);
  });
});

describe('billsStore — editBill', () => {
  it('throws when DB update fails, state remains unchanged', async () => {
    useBillsStore.setState({ bills: [bill({ id: 'b1', title: 'Rent', amount: 900 })] });
    mockFrom.mockReturnValue(fail('timeout'));

    await expect(
      useBillsStore.getState().editBill('b1', { title: 'Updated Rent', amount: 1000, date: '2026-05-01', notes: '', category: 'Rent' })
    ).rejects.toThrow('Could not update the bill. Please try again.');

    expect(useBillsStore.getState().bills[0].title).toBe('Rent');
    expect(useBillsStore.getState().bills[0].amount).toBe(900);
  });

  it('updates state on success', async () => {
    useBillsStore.setState({ bills: [bill({ id: 'b1', title: 'Rent' })] });
    mockFrom.mockReturnValue(ok());

    await useBillsStore.getState().editBill('b1', { title: 'New Rent', amount: 1000, date: '2026-05-01', notes: 'increased', category: 'Groceries' });

    expect(useBillsStore.getState().bills[0].title).toBe('New Rent');
    expect(useBillsStore.getState().bills[0].category).toBe('Groceries');
  });
});

describe('billsStore — load', () => {
  it('sets error state and isLoading=false on DB failure', async () => {
    // The store does `if (error) throw error` where error is a plain object {message}.
    // The catch checks `err instanceof Error` — false for a plain object — so it
    // falls back to the generic string. The real DB error message is swallowed.
    mockFrom.mockReturnValue(fail('connection refused'));

    await useBillsStore.getState().load('house-1');

    expect(useBillsStore.getState().error).toBe('Could not load bills. Please try again.');
    expect(useBillsStore.getState().isLoading).toBe(false);
  });

  it('maps DB rows to Bill objects correctly', async () => {
    const row = {
      id: 'b1', title: 'Internet', amount: '45.00', paid_by: 'Bob',
      split_between: ['Alice', 'Bob'], split_amounts: null, category: 'Internet',
      date: '2026-04-15', created_at: '2026-04-15T10:00:00Z',
      settled: false, settled_by: null, settled_at: null, notes: null,
    };
    mockFrom.mockReturnValue({ ...ok([row]), order: jest.fn(() => ok([row])) });

    await useBillsStore.getState().load('house-1');

    const b = useBillsStore.getState().bills[0];
    expect(b.amount).toBe(45); // Number('45.00') = 45
    expect(b.paidBy).toBe('Bob');
    expect(b.splitBetween).toEqual(['Alice', 'Bob']);
  });
});
