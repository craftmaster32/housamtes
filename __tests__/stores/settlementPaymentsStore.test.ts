/**
 * QA — settlementPaymentsStore
 *
 * Covers loading, recording a payment (full or partial), "settle up to a date",
 * and undo — including the safety rules: only the payer or receiver can record
 * or delete, and a database refusal is reported instead of faked locally.
 */
const mockFrom = jest.fn();
const mockNotify = jest.fn();
let mockUserId = 'maya';

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
jest.mock('@lib/notifyHousemates', () => ({
  notifyHousemates: (...a: unknown[]): unknown => mockNotify(...a),
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: {
    getState: (): { houseId: string; profile: { id: string } } => ({
      houseId: 'house-1',
      profile: { id: mockUserId },
    }),
  },
}));

import {
  useSettlementPaymentsStore,
  SettlementDeleteNotAllowedError,
} from '@stores/settlementPaymentsStore';
import { endOfLastMonth } from '@hooks/useSettleUpToDate';
import { ok, fail } from '../__helpers__/supabaseMock';

const row = (
  id: string,
  from: string,
  to: string,
  amount: number,
  coversUntil: string | null = null
): Record<string, unknown> => ({
  id,
  from_user: from,
  to_user: to,
  amount: String(amount),
  paid_on: '2026-11-04',
  covers_until: coversUntil,
  note: null,
  created_by: 'maya',
  created_at: '2026-11-04T10:00:00Z',
});

const names = { fromName: 'Dana', toName: 'Maya', money: '₪100.00' };

beforeEach(() => {
  useSettlementPaymentsStore.setState({ payments: [], isLoading: false, error: null });
  jest.clearAllMocks();
  mockFrom.mockReset();
  mockUserId = 'maya';
});

describe('load', () => {
  it('loads payments with amounts as numbers', async () => {
    mockFrom.mockReturnValue(ok([row('s1', 'dana', 'maya', 120.5)]));
    await useSettlementPaymentsStore.getState().load('house-1');
    const { payments, error } = useSettlementPaymentsStore.getState();
    expect(error).toBeNull();
    expect(payments).toEqual([
      expect.objectContaining({ id: 's1', from: 'dana', to: 'maya', amount: 120.5 }),
    ]);
  });

  it('shows an error when loading fails, so balances are not silently wrong', async () => {
    mockFrom.mockReturnValue(fail('boom'));
    await useSettlementPaymentsStore.getState().load('house-1');
    expect(useSettlementPaymentsStore.getState().error).toMatch(/Could not load/);
  });
});

describe('recordPayment', () => {
  const partial = { from: 'dana', to: 'maya', amount: 100, paidOn: '2026-11-04', note: null };

  it('saves a partial payment and tells only the other person', async () => {
    mockFrom.mockReturnValue(ok(row('s1', 'dana', 'maya', 100)));
    await useSettlementPaymentsStore.getState().recordPayment(partial, 'house-1', names);
    expect(useSettlementPaymentsStore.getState().payments).toHaveLength(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ includeUserIds: ['dana'], copyKey: 'settlement_payment' })
    );
  });

  it('refuses a payment the current user is not part of', async () => {
    mockUserId = 'tom';
    await expect(
      useSettlementPaymentsStore.getState().recordPayment(partial, 'house-1', names)
    ).rejects.toThrow(/paid or received/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('refuses zero, negative and self payments before reaching the database', async () => {
    const store = useSettlementPaymentsStore.getState();
    await expect(
      store.recordPayment({ ...partial, amount: 0 }, 'house-1', names)
    ).rejects.toThrow();
    await expect(
      store.recordPayment({ ...partial, amount: -5 }, 'house-1', names)
    ).rejects.toThrow();
    await expect(
      store.recordPayment({ ...partial, from: 'maya', to: 'maya' }, 'house-1', names)
    ).rejects.toThrow();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('keeps the list unchanged when saving fails', async () => {
    mockFrom.mockReturnValue(fail('nope'));
    await expect(
      useSettlementPaymentsStore.getState().recordPayment(partial, 'house-1', names)
    ).rejects.toThrow(/Could not save/);
    expect(useSettlementPaymentsStore.getState().payments).toHaveLength(0);
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

describe('recordSettleUpTo', () => {
  it('saves every transfer in one insert, labelled with the date', async () => {
    // A multi-row insert is awaited as insert([...]).select() — the shared
    // helper only fakes insert().select().single(), so fake this one directly.
    const rows = [
      row('s1', 'dana', 'maya', 300, '2026-10-31'),
      row('s2', 'tom', 'maya', 300, '2026-10-31'),
    ];
    const insert = jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: rows, error: null })),
    }));
    mockFrom.mockReturnValue({ insert });
    await useSettlementPaymentsStore.getState().recordSettleUpTo(
      [
        { from: 'dana', to: 'maya', amount: 300 },
        { from: 'tom', to: 'maya', amount: 300 },
      ],
      '2026-10-31',
      'house-1',
      'Maya'
    );
    expect(mockFrom).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ from_user: 'dana', amount: 300, covers_until: '2026-10-31' }),
      expect.objectContaining({ from_user: 'tom', amount: 300, covers_until: '2026-10-31' }),
    ]);
    const payments = useSettlementPaymentsStore.getState().payments;
    expect(payments).toHaveLength(2);
    expect(payments.every((p) => p.coversUntil === '2026-10-31')).toBe(true);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ includeUserIds: ['dana', 'tom'], copyKey: 'settled_up_to' })
    );
  });

  it('refuses transfers the current user is not part of', async () => {
    await expect(
      useSettlementPaymentsStore
        .getState()
        .recordSettleUpTo(
          [{ from: 'dana', to: 'tom', amount: 50 }],
          '2026-10-31',
          'house-1',
          'Maya'
        )
    ).rejects.toThrow(/paid or received/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does nothing for an empty plan', async () => {
    await useSettlementPaymentsStore
      .getState()
      .recordSettleUpTo([], '2026-10-31', 'house-1', 'Maya');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('deletePayment', () => {
  beforeEach(() => {
    useSettlementPaymentsStore.setState({
      payments: [
        {
          id: 's1',
          from: 'dana',
          to: 'maya',
          amount: 100,
          paidOn: '2026-11-04',
          coversUntil: null,
          note: null,
          createdBy: 'dana',
          createdAt: '2026-11-04T10:00:00Z',
        },
      ],
    });
  });

  it('removes the payment when the database deletes it', async () => {
    mockFrom.mockReturnValue(ok([{ id: 's1' }]));
    await useSettlementPaymentsStore.getState().deletePayment('s1');
    expect(useSettlementPaymentsStore.getState().payments).toHaveLength(0);
  });

  it('reports a refusal and keeps the payment', async () => {
    mockFrom.mockReturnValue(ok([]));
    await expect(useSettlementPaymentsStore.getState().deletePayment('s1')).rejects.toBeInstanceOf(
      SettlementDeleteNotAllowedError
    );
    expect(useSettlementPaymentsStore.getState().payments).toHaveLength(1);
  });
});

describe('endOfLastMonth', () => {
  it('is the last day of the previous month', () => {
    expect(endOfLastMonth('2026-11-04')).toBe('2026-10-31');
    expect(endOfLastMonth('2026-03-15')).toBe('2026-02-28');
    expect(endOfLastMonth('2026-01-01')).toBe('2025-12-31');
  });
});
