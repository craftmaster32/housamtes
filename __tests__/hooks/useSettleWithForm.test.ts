/**
 * QA — useSettleWithForm ("Settle with Maya")
 *
 * One tap pays everything left; part of it can be entered instead; a settle-up
 * never goes past zero; and a recorded payment can be changed or deleted.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (k: string) => string } => ({ t: (k: string): string => k }),
}));
const mockAlert = jest.fn();
jest.mock('@lib/alert', () => ({
  Alert: { alert: (...a: unknown[]): unknown => mockAlert(...a) },
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown): unknown =>
    sel({ houseId: 'house-1', profile: { id: 'dana' } }),
}));
jest.mock('@stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: unknown) => unknown): unknown => sel({ currencyCode: 'ILS' }),
}));
const mockRecord = jest.fn<Promise<void>, unknown[]>(async () => {});
const mockUpdate = jest.fn(async (): Promise<void> => {});
const mockDelete = jest.fn(async (): Promise<void> => {});
let mockPayments: unknown[] = [];
jest.mock('@stores/settlementPaymentsStore', () => ({
  useSettlementPaymentsStore: (sel: (s: unknown) => unknown): unknown =>
    sel({
      payments: mockPayments,
      recordPayment: mockRecord,
      updatePayment: mockUpdate,
      deletePayment: mockDelete,
    }),
  SettlementDeleteNotAllowedError: class extends Error {},
}));
// Dana owes Maya 100.12 (after already paying 50.12, which is in `net`).
jest.mock('@hooks/useHouseMoney', () => ({
  useHouseMoney: (): { net: Map<string, number> } => ({
    net: new Map([
      ['maya', 100.12],
      ['dana', -100.12],
    ]),
  }),
}));
jest.mock('@hooks/useMemberName', () => ({
  useMemberName:
    (): ((id: string) => string) =>
    (id: string): string =>
      id,
}));

import { useSettleWithForm, parseAmount } from '@hooks/useSettleWithForm';

const transfer = { from: 'dana', to: 'maya', amount: 100.12 };
const recorded = {
  id: 's1',
  from: 'dana',
  to: 'maya',
  amount: 50.12,
  paidOn: '2026-11-04',
  coversUntil: null,
  note: null,
  createdBy: 'dana',
  createdAt: '2026-11-04T10:00:00Z',
  updatedAt: '2026-11-04T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPayments = [];
});

describe('useSettleWithForm — new settle-up', () => {
  it('"Paid it all" records exactly what is left, in one tap', async () => {
    const onDone = jest.fn();
    const { result } = renderHook(() => useSettleWithForm({ visible: true, transfer, onDone }));
    expect(result.current.maxSettle).toBe(100.12);
    act(() => result.current.payAll());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'dana', to: 'maya', amount: 100.12 }),
      'house-1',
      expect.anything()
    );
  });

  it('part of it can be entered and saved', async () => {
    const { result } = renderHook(() =>
      useSettleWithForm({ visible: true, transfer, onDone: jest.fn() })
    );
    act(() => result.current.setAmount('40'));
    expect(result.current.canSave).toBe(true);
    act(() => result.current.save());
    await waitFor(() => expect(mockRecord).toHaveBeenCalled());
    expect(mockRecord.mock.calls[0][0]).toMatchObject({ amount: 40 });
  });

  it('never more than what is left (anything extra is a bill)', () => {
    const { result } = renderHook(() =>
      useSettleWithForm({ visible: true, transfer, onDone: jest.fn() })
    );
    act(() => result.current.setAmount('100.13'));
    expect(result.current.tooMuch).toBe(true);
    expect(result.current.canSave).toBe(false);
  });
});

describe('useSettleWithForm — editing a recorded payment', () => {
  it('its own amount is back on the table, so it can be raised up to what is owed', () => {
    const { result } = renderHook(() =>
      useSettleWithForm({ visible: true, payment: recorded, onDone: jest.fn() })
    );
    // 100.12 still owed + the 50.12 this payment already covers.
    expect(result.current.maxSettle).toBe(150.24);
    expect(result.current.amount).toBe('50.12');
    act(() => result.current.setAmount('150.24'));
    expect(result.current.canSave).toBe(true);
    act(() => result.current.setAmount('150.25'));
    expect(result.current.tooMuch).toBe(true);
  });

  it('saves a change through the store', async () => {
    const onDone = jest.fn();
    const { result } = renderHook(() =>
      useSettleWithForm({ visible: true, payment: recorded, onDone })
    );
    act(() => result.current.setAmount('60'));
    act(() => result.current.save());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockUpdate).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ amount: 60 }),
      expect.anything()
    );
    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('deletes only after "Delete" is confirmed', async () => {
    const onDone = jest.fn();
    const { result } = renderHook(() =>
      useSettleWithForm({ visible: true, payment: recorded, onDone })
    );
    act(() => result.current.remove());
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockDelete).not.toHaveBeenCalled();
    (mockAlert.mock.calls[0][2] as { onPress: () => void }[])[1].onPress();
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mockDelete).toHaveBeenCalledWith('s1', expect.anything());
  });
});

describe('parseAmount', () => {
  it('reads both decimal marks and refuses thousands separators', () => {
    expect(parseAmount('120,50')).toBe(120.5);
    expect(parseAmount('120.5')).toBe(120.5);
    expect(parseAmount('1,000')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
  });
});
