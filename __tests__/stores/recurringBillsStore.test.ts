/**
 * QA — recurringBillsStore
 *
 * Covers:
 *  1. The fairness / net-contribution math that feeds Settle Up:
 *     - a single logged payment is split across all housemates (not just the payer)
 *     - an explicit per-payment split overrides the default "everyone" split
 *     - balances always net to ~0 so they combine cleanly with one-off bills
 *  2. Store actions (money CRUD): load, addBill, deleteBill, logPayment,
 *     deletePayment — happy path and failure path for each.
 *  3. Due-date helpers: getLastPayment, getNextDueDate.
 */

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
  },
}));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('@stores/authStore', () => ({
  useAuthStore: {
    getState: (): { houseId: string; profile: { id: string } } => ({
      houseId: 'house-1',
      profile: { id: 'user-logger' },
    }),
  },
}));

import {
  calculateFairness,
  getLastPayment,
  getNextDueDate,
  useRecurringBillsStore,
  type RecurringBill,
  type HouseholdPayment,
} from '@stores/recurringBillsStore';
import { ok, fail } from '../__helpers__/supabaseMock';

const bill = (id: string, assignedTo: string): RecurringBill => ({
  id,
  name: `Bill ${id}`,
  assignedTo,
  frequency: 'monthly',
  typicalAmount: 0,
  icon: '🧾',
  createdAt: '2026-01-01T00:00:00Z',
  editedAt: null,
  editedBy: null,
});

const payment = (billId: string, amount: number, splitBetween?: string[]): HouseholdPayment => ({
  id: `p-${billId}-${amount}`,
  billId,
  amount,
  paidAt: '2026-07-01',
  createdAt: '2026-07-01T00:00:00Z',
  note: '',
  splitBetween,
  loggedBy: null,
  editedAt: null,
  editedBy: null,
});

beforeEach(() => {
  useRecurringBillsStore.setState({ bills: [], payments: [], isLoading: false, error: null });
  jest.clearAllMocks();
  // Also drop configured return values (clearAllMocks only clears call history),
  // so a persistent mockReturnValue can't leak into later tests.
  mockFrom.mockReset();
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

// ─────────────────────────────────────────────────────────────────────────────
// Due-date helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('getLastPayment', () => {
  it('returns the most recent payment for the bill', () => {
    const payments = [
      { ...payment('b1', 100), id: 'old', paidAt: '2026-05-01' },
      { ...payment('b1', 100), id: 'new', paidAt: '2026-07-01' },
      { ...payment('b2', 999), id: 'other-bill', paidAt: '2026-08-01' },
    ];
    expect(getLastPayment('b1', payments)?.id).toBe('new');
  });

  it('returns null when the bill has no payments', () => {
    expect(getLastPayment('b1', [payment('b2', 50)])).toBeNull();
  });
});

describe('getNextDueDate', () => {
  it('advances one month from the last payment for a monthly bill', () => {
    const b = bill('b1', 'alice');
    const payments = [{ ...payment('b1', 100), paidAt: '2026-07-15' }];
    expect(getNextDueDate(b, payments)).toBe('2026-08-15');
  });

  it('advances three months for a quarterly bill', () => {
    const b: RecurringBill = { ...bill('b1', 'alice'), frequency: 'quarterly' };
    const payments = [{ ...payment('b1', 100), paidAt: '2026-01-31' }];
    // date-fns addMonths clamps to the end of the shorter month.
    expect(getNextDueDate(b, payments)).toBe('2026-04-30');
  });

  it('falls back to the bill nextDueDate when nothing was paid yet', () => {
    const b: RecurringBill = { ...bill('b1', 'alice'), nextDueDate: '2026-09-01' };
    expect(getNextDueDate(b, [])).toBe('2026-09-01');
  });

  it('returns null with no payments and no nextDueDate', () => {
    expect(getNextDueDate(bill('b1', 'alice'), [])).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Store actions
// ─────────────────────────────────────────────────────────────────────────────

describe('load', () => {
  it('maps snake_case rows into bills and payments', async () => {
    mockFrom
      .mockReturnValueOnce(
        ok([
          {
            id: 'b1',
            name: 'Electricity',
            assigned_to: 'alice',
            frequency: 'bimonthly',
            typical_amount: '340.5',
            icon: '⚡',
            created_at: '2026-01-01T00:00:00Z',
            next_due_date: '2026-08-01',
          },
        ])
      )
      .mockReturnValueOnce(
        ok([
          {
            id: 'p1',
            bill_id: 'b1',
            amount: '341',
            paid_at: '2026-06-01',
            created_at: '2026-06-01T09:00:00Z',
            note: null,
            split_between: [],
          },
        ])
      );

    await useRecurringBillsStore.getState().load('house-1');

    const s = useRecurringBillsStore.getState();
    expect(s.error).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.bills).toEqual([
      {
        id: 'b1',
        name: 'Electricity',
        assignedTo: 'alice',
        frequency: 'bimonthly',
        typicalAmount: 340.5,
        icon: '⚡',
        createdAt: '2026-01-01T00:00:00Z',
        nextDueDate: '2026-08-01',
        editedAt: null,
        editedBy: null,
      },
    ]);
    // Empty split_between array is the "everyone" sentinel → undefined in the app model.
    expect(s.payments[0]).toEqual({
      id: 'p1',
      billId: 'b1',
      amount: 341,
      paidAt: '2026-06-01',
      createdAt: '2026-06-01T09:00:00Z',
      note: '',
      splitBetween: undefined,
      loggedBy: null,
      editedAt: null,
      editedBy: null,
    });
  });

  it('sets a user-facing error and stops loading when the query fails', async () => {
    mockFrom.mockReturnValue(fail('boom'));

    await useRecurringBillsStore.getState().load('house-1');

    const s = useRecurringBillsStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe('Could not load bills. Please try again.');
    expect(s.bills).toEqual([]);
  });

  it('aborts and clears the spinner when the house ID does not match auth', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    useRecurringBillsStore.setState({ isLoading: true, bills: [bill('b1', 'alice')] });

    await useRecurringBillsStore.getState().load('some-other-house');

    expect(mockFrom).not.toHaveBeenCalled(); // never queries the wrong house
    expect(useRecurringBillsStore.getState().bills).toHaveLength(1); // data untouched
    expect(useRecurringBillsStore.getState().isLoading).toBe(false); // no stuck spinner
    warn.mockRestore();
  });
});

describe('addBill', () => {
  it('appends the inserted bill and returns it', async () => {
    mockFrom.mockReturnValueOnce(
      ok({
        id: 'b9',
        name: 'Water',
        assigned_to: 'bob',
        frequency: 'monthly',
        typical_amount: '120',
        icon: null,
        created_at: '2026-07-01T00:00:00Z',
        next_due_date: null,
      })
    );

    const returned = await useRecurringBillsStore
      .getState()
      .addBill(
        { name: 'Water', assignedTo: 'bob', frequency: 'monthly', typicalAmount: 120, icon: '💧' },
        'house-1'
      );

    expect(returned.id).toBe('b9');
    expect(returned.icon).toBe('receipt-outline'); // null icon falls back to the default
    expect(returned.typicalAmount).toBe(120);
    expect(useRecurringBillsStore.getState().bills).toHaveLength(1);
  });

  it('throws a plain-English error and adds nothing when the insert fails', async () => {
    mockFrom.mockReturnValueOnce(fail('insert failed'));

    await expect(
      useRecurringBillsStore.getState().addBill(
        {
          name: 'Water',
          assignedTo: 'bob',
          frequency: 'monthly',
          typicalAmount: 120,
          icon: '💧',
        },
        'house-1'
      )
    ).rejects.toThrow('Could not save the bill. Please try again.');
    expect(useRecurringBillsStore.getState().bills).toHaveLength(0);
  });
});

describe('updateBill', () => {
  it('applies the edited fields to the matching bill', async () => {
    useRecurringBillsStore.setState({ bills: [bill('b1', 'alice'), bill('b2', 'bob')] });
    mockFrom.mockReturnValueOnce(
      ok({
        id: 'b1',
        name: 'Electric (edited)',
        assigned_to: 'bob',
        frequency: 'quarterly',
        typical_amount: '420',
        icon: 'flash-outline',
        created_at: '2026-01-01T00:00:00Z',
        next_due_date: null,
      })
    );

    await useRecurringBillsStore.getState().updateBill('b1', {
      name: 'Electric (edited)',
      assignedTo: 'bob',
      frequency: 'quarterly',
      typicalAmount: 420,
      icon: 'flash-outline',
    });

    const s = useRecurringBillsStore.getState();
    const edited = s.bills.find((b) => b.id === 'b1');
    expect(edited).toMatchObject({
      name: 'Electric (edited)',
      assignedTo: 'bob',
      frequency: 'quarterly',
      typicalAmount: 420,
      icon: 'flash-outline',
    });
    // The other bill is left untouched.
    expect(s.bills.find((b) => b.id === 'b2')?.name).toBe('Bill b2');
  });

  it('throws a plain-English error and changes nothing when the update fails', async () => {
    useRecurringBillsStore.setState({ bills: [bill('b1', 'alice')] });
    mockFrom.mockReturnValueOnce(fail('update failed'));

    await expect(
      useRecurringBillsStore.getState().updateBill('b1', {
        name: 'Nope',
        assignedTo: 'bob',
        frequency: 'monthly',
        typicalAmount: 10,
        icon: 'flash-outline',
      })
    ).rejects.toThrow('Could not update the bill. Please try again.');
    expect(useRecurringBillsStore.getState().bills[0].name).toBe('Bill b1');
  });
});

describe('deleteBill', () => {
  it('removes the bill and its payments', async () => {
    useRecurringBillsStore.setState({
      bills: [bill('b1', 'alice'), bill('b2', 'bob')],
      payments: [payment('b1', 100), payment('b2', 50)],
    });
    mockFrom.mockReturnValueOnce(ok());

    await useRecurringBillsStore.getState().deleteBill('b1');

    const s = useRecurringBillsStore.getState();
    expect(s.bills.map((b) => b.id)).toEqual(['b2']);
    expect(s.payments.map((p) => p.billId)).toEqual(['b2']);
  });

  it('keeps state intact when the delete fails', async () => {
    useRecurringBillsStore.setState({
      bills: [bill('b1', 'alice')],
      payments: [payment('b1', 100)],
    });
    mockFrom.mockReturnValueOnce(fail('nope'));

    await expect(useRecurringBillsStore.getState().deleteBill('b1')).rejects.toThrow(
      'Could not delete the bill. Please try again.'
    );
    expect(useRecurringBillsStore.getState().bills).toHaveLength(1);
    expect(useRecurringBillsStore.getState().payments).toHaveLength(1);
  });
});

describe('logPayment', () => {
  it('prepends the inserted payment', async () => {
    useRecurringBillsStore.setState({ payments: [payment('b1', 1)] });
    mockFrom.mockReturnValueOnce(
      ok({
        id: 'p9',
        bill_id: 'b1',
        amount: '250',
        paid_at: '2026-07-10',
        created_at: '2026-07-10T12:00:00Z',
        note: 'June bill',
        split_between: ['alice', 'bob'],
      })
    );

    await useRecurringBillsStore.getState().logPayment(
      {
        billId: 'b1',
        amount: 250,
        paidAt: '2026-07-10',
        note: 'June bill',
        splitBetween: ['alice', 'bob'],
      },
      'house-1'
    );

    const s = useRecurringBillsStore.getState();
    expect(s.payments).toHaveLength(2);
    expect(s.payments[0]).toEqual({
      id: 'p9',
      billId: 'b1',
      amount: 250,
      paidAt: '2026-07-10',
      createdAt: '2026-07-10T12:00:00Z',
      note: 'June bill',
      splitBetween: ['alice', 'bob'],
      // Attributed to whoever logged it, not the bill's assignee.
      loggedBy: 'user-logger',
      editedAt: null,
      editedBy: null,
    });
  });

  it('throws a plain-English error and adds nothing when the insert fails', async () => {
    mockFrom.mockReturnValueOnce(fail('insert failed'));

    await expect(
      useRecurringBillsStore
        .getState()
        .logPayment({ billId: 'b1', amount: 250, paidAt: '2026-07-10', note: '' }, 'house-1')
    ).rejects.toThrow('Could not log the payment. Please try again.');
    expect(useRecurringBillsStore.getState().payments).toHaveLength(0);
  });
});

describe('updatePayment', () => {
  it('applies the edited amount, date, note and split to the matching payment', async () => {
    const p1 = { ...payment('b1', 100), id: 'p1' };
    const p2 = { ...payment('b1', 200), id: 'p2' };
    useRecurringBillsStore.setState({ payments: [p1, p2] });
    const chain = ok({
      id: 'p1',
      bill_id: 'b1',
      amount: '175',
      paid_at: '2026-08-15',
      note: 'fixed typo',
      split_between: ['alice', 'bob'],
      edited_at: '2026-08-15T10:00:00Z',
      edited_by: 'user-editor',
    });
    mockFrom.mockReturnValueOnce(chain);

    await useRecurringBillsStore.getState().updatePayment('p1', {
      amount: 175,
      paidAt: '2026-08-15',
      note: 'fixed typo',
      splitBetween: ['alice', 'bob'],
    });

    // The update sends the acting user (profile id) as the editor; the value mapped
    // back into state comes from the DB response above (which the trigger authored).
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ edited_by: 'user-logger', edited_at: expect.any(String) })
    );

    const s = useRecurringBillsStore.getState();
    expect(s.payments.find((p) => p.id === 'p1')).toEqual({
      id: 'p1',
      billId: 'b1',
      amount: 175,
      paidAt: '2026-08-15',
      createdAt: '2026-07-01T00:00:00Z',
      note: 'fixed typo',
      splitBetween: ['alice', 'bob'],
      loggedBy: null,
      editedAt: '2026-08-15T10:00:00Z',
      editedBy: 'user-editor',
    });
    // The other payment is untouched.
    expect(s.payments.find((p) => p.id === 'p2')?.amount).toBe(200);
  });

  it('treats an empty split as the everyone sentinel (undefined in the app model)', async () => {
    useRecurringBillsStore.setState({ payments: [{ ...payment('b1', 100), id: 'p1' }] });
    mockFrom.mockReturnValueOnce(
      ok({
        id: 'p1',
        bill_id: 'b1',
        amount: '100',
        paid_at: '2026-07-01',
        note: '',
        split_between: [],
      })
    );

    await useRecurringBillsStore
      .getState()
      .updatePayment('p1', { amount: 100, paidAt: '2026-07-01', note: '', splitBetween: [] });

    expect(useRecurringBillsStore.getState().payments[0].splitBetween).toBeUndefined();
  });

  it('throws a plain-English error and changes nothing when the update fails', async () => {
    useRecurringBillsStore.setState({ payments: [{ ...payment('b1', 100), id: 'p1' }] });
    mockFrom.mockReturnValueOnce(fail('update failed'));

    await expect(
      useRecurringBillsStore
        .getState()
        .updatePayment('p1', { amount: 999, paidAt: '2026-09-01', note: 'nope' })
    ).rejects.toThrow('Could not update the payment. Please try again.');
    expect(useRecurringBillsStore.getState().payments[0].amount).toBe(100);
  });
});

describe('deletePayment', () => {
  it('removes only the targeted payment', async () => {
    const p1 = { ...payment('b1', 100), id: 'p1' };
    const p2 = { ...payment('b1', 200), id: 'p2' };
    useRecurringBillsStore.setState({ payments: [p1, p2] });
    mockFrom.mockReturnValueOnce(ok());

    await useRecurringBillsStore.getState().deletePayment('p1');

    expect(useRecurringBillsStore.getState().payments.map((p) => p.id)).toEqual(['p2']);
  });

  it('keeps the payment when the delete fails', async () => {
    useRecurringBillsStore.setState({ payments: [{ ...payment('b1', 100), id: 'p1' }] });
    mockFrom.mockReturnValueOnce(fail('nope'));

    await expect(useRecurringBillsStore.getState().deletePayment('p1')).rejects.toThrow(
      'Could not delete the payment. Please try again.'
    );
    expect(useRecurringBillsStore.getState().payments).toHaveLength(1);
  });
});

describe('clearError', () => {
  it('resets the error to null', () => {
    useRecurringBillsStore.setState({ error: 'something broke' });
    useRecurringBillsStore.getState().clearError();
    expect(useRecurringBillsStore.getState().error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Realtime subscription lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/** A query chain whose promise resolves only when the test says so. */
function deferredOk(data: unknown): { chain: Record<string, unknown>; resolve: () => void } {
  let resolveFn: (v: unknown) => void = () => {};
  const p = new Promise((res) => {
    resolveFn = res;
  });
  const chain: Record<string, unknown> = {
    then: (
      res: Parameters<Promise<unknown>['then']>[0],
      rej: Parameters<Promise<unknown>['then']>[1]
    ): Promise<unknown> => p.then(res, rej),
  };
  for (const m of ['select', 'eq', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  return { chain, resolve: (): void => resolveFn({ data, error: null }) };
}

describe('realtime subscription lifecycle', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { supabase } = require('@lib/supabase') as {
    supabase: { channel: jest.Mock; removeChannel: jest.Mock };
  };

  beforeEach(() => {
    // Module-level channel state persists across tests — reset it explicitly.
    useRecurringBillsStore.getState().unsubscribe();
    supabase.channel.mockClear();
  });

  it('keeps the existing channel when a realtime reload fires for the same house', async () => {
    mockFrom.mockReturnValue(ok([]));

    await useRecurringBillsStore.getState().load('house-1');
    await useRecurringBillsStore.getState().load('house-1'); // realtime-triggered reload

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it('does not resubscribe or commit state when unsubscribe() runs mid-load', async () => {
    const bills = deferredOk([
      {
        id: 'b1',
        name: 'Electricity',
        assigned_to: 'alice',
        frequency: 'monthly',
        typical_amount: '100',
        icon: '⚡',
        created_at: '2026-01-01T00:00:00Z',
        next_due_date: null,
      },
    ]);
    const payments = deferredOk([]);
    mockFrom.mockReturnValueOnce(bills.chain).mockReturnValueOnce(payments.chain);

    const inFlight = useRecurringBillsStore.getState().load('house-1');
    useRecurringBillsStore.getState().unsubscribe(); // user leaves the screen
    bills.resolve();
    payments.resolve();
    await inFlight;

    expect(useRecurringBillsStore.getState().bills).toEqual([]); // stale result dropped
    expect(supabase.channel).not.toHaveBeenCalled(); // no zombie subscription
  });

  it('lets the newest load win when an older one resolves after it', async () => {
    const staleBills = deferredOk([
      {
        id: 'b-stale',
        name: 'Old data',
        assigned_to: 'alice',
        frequency: 'monthly',
        typical_amount: '1',
        icon: '🧾',
        created_at: '2026-01-01T00:00:00Z',
        next_due_date: null,
      },
    ]);
    const stalePayments = deferredOk([]);
    mockFrom.mockReturnValueOnce(staleBills.chain).mockReturnValueOnce(stalePayments.chain);
    const stale = useRecurringBillsStore.getState().load('house-1');

    mockFrom
      .mockReturnValueOnce(
        ok([
          {
            id: 'b-fresh',
            name: 'Fresh data',
            assigned_to: 'alice',
            frequency: 'monthly',
            typical_amount: '2',
            icon: '🧾',
            created_at: '2026-01-02T00:00:00Z',
            next_due_date: null,
          },
        ])
      )
      .mockReturnValueOnce(ok([]));
    await useRecurringBillsStore.getState().load('house-1');

    staleBills.resolve();
    stalePayments.resolve();
    await stale;

    expect(useRecurringBillsStore.getState().bills.map((b) => b.id)).toEqual(['b-fresh']);
  });
});
