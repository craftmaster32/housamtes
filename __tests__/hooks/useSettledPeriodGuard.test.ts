/**
 * QA — useSettledPeriodGuard
 *
 * Changing an expense from a period that was already settled up must never be
 * silent: the user is warned first, and the house gets exactly one message.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));

const mockAlert = jest.fn();
const mockNotify = jest.fn();
let mockPayments: unknown[] = [];
let mockStoreError: string | null = null;
const mockLoad = jest.fn(async (): Promise<void> => {});

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (k: string) => string } => ({ t: (k: string): string => k }),
}));
jest.mock('@lib/alert', () => ({
  Alert: { alert: (...a: unknown[]): unknown => mockAlert(...a) },
}));
jest.mock('@lib/notifyHousemates', () => ({
  notifyHousemates: (...a: unknown[]): unknown => mockNotify(...a),
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown): unknown =>
    sel({ houseId: 'house-1', profile: { id: 'maya', name: 'Maya' } }),
}));
jest.mock('@stores/settlementPaymentsStore', () => {
  const state = (): Record<string, unknown> => ({
    payments: mockPayments,
    isLoading: false,
    error: mockStoreError,
    load: mockLoad,
  });
  const hook = (sel: (s: Record<string, unknown>) => unknown): unknown => sel(state());
  hook.getState = state;
  return { useSettlementPaymentsStore: hook };
});

import { useSettledPeriodGuard } from '@hooks/useSettledPeriodGuard';
import { latestSettledUntil, type SettlementPayment } from '@utils/settleUp';

const settled = (coversUntil: string | null): SettlementPayment => ({
  id: Math.random().toString(36),
  from: 'dana',
  to: 'maya',
  amount: 300,
  paidOn: '2026-11-02',
  coversUntil,
  note: null,
  createdBy: 'maya',
  createdAt: '2026-11-02T10:00:00Z',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPayments = [];
  mockStoreError = null;
});

describe('latestSettledUntil', () => {
  it('is the latest "settled up to" date, ignoring plain payments', () => {
    expect(latestSettledUntil([])).toBeNull();
    expect(latestSettledUntil([settled(null)])).toBeNull();
    expect(latestSettledUntil([settled('2026-09-30'), settled('2026-10-31'), settled(null)])).toBe(
      '2026-10-31'
    );
  });
});

describe('useSettledPeriodGuard', () => {
  it('does nothing when the house never settled up to a date', async () => {
    mockPayments = [settled(null)];
    const { result } = renderHook(() => useSettledPeriodGuard());
    expect(result.current.isSettled('2026-01-01')).toBe(false);
    await expect(result.current.confirmChange('2026-01-01')).resolves.toEqual({
      proceed: true,
      settled: false,
    });
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('flags dates on or before the settled date only', () => {
    mockPayments = [settled('2026-10-31')];
    const { result } = renderHook(() => useSettledPeriodGuard());
    expect(result.current.isSettled('2026-10-31')).toBe(true);
    expect(result.current.isSettled('2026-10-05')).toBe(true);
    expect(result.current.isSettled('2026-11-01')).toBe(false);
    // An edit that moves a bill INTO the settled period counts too.
    expect(result.current.isSettled('2026-11-05', '2026-10-20')).toBe(true);
  });

  it('asks first, and goes ahead only when confirmed', async () => {
    mockPayments = [settled('2026-10-31')];
    const { result } = renderHook(() => useSettledPeriodGuard());

    const first = result.current.confirmChange('2026-10-10');
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
    (mockAlert.mock.calls[0][2] as { onPress: () => void }[])[1].onPress(); // "Change anyway"
    await expect(first).resolves.toEqual({ proceed: true, settled: true });

    const second = result.current.confirmChange('2026-10-10');
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(2));
    (mockAlert.mock.calls[1][2] as { onPress: () => void }[])[0].onPress(); // Cancel
    await expect(second).resolves.toEqual({ proceed: false, settled: true });
  });

  it('never silently says "not settled" when the payments could not be loaded', async () => {
    mockStoreError = 'offline';
    const { result } = renderHook(() => useSettledPeriodGuard());

    const check = result.current.confirmChange('2026-10-10');
    await waitFor(() => expect(mockAlert).toHaveBeenCalledTimes(1));
    expect(mockLoad).toHaveBeenCalledWith('house-1'); // tried again first
    expect(mockAlert.mock.calls[0][0]).toBe('bills.settled_unknown_title');
    (mockAlert.mock.calls[0][2] as { onPress: () => void }[])[1].onPress();
    await expect(check).resolves.toEqual({ proceed: true, settled: false });
  });

  it('sends the house exactly one message, not to the person who made the change', () => {
    mockPayments = [settled('2026-10-31')];
    const { result } = renderHook(() => useSettledPeriodGuard());
    result.current.notifyChange('Pizza');
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeUserId: 'maya',
        copyKey: 'settled_period_changed',
        copyParams: { name: 'Maya', billTitle: 'Pizza', date: '2026-10-31' },
      })
    );
  });
});
