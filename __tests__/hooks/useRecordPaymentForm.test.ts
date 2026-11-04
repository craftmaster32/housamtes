/**
 * QA — useRecordPaymentForm
 *
 * A settle-up can only bring a debt down to zero. Anything beyond that isn't
 * paying anyone back, so the form refuses it (it should be added as a bill).
 */
import { renderHook, act } from '@testing-library/react-native';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (k: string) => string } => ({ t: (k: string): string => k }),
}));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('@stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown): unknown =>
    sel({ houseId: 'house-1', profile: { id: 'maya' } }),
}));
jest.mock('@stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: unknown) => unknown): unknown => sel({ currencyCode: 'ILS' }),
}));
const mockRecord = jest.fn(async (): Promise<void> => {});
jest.mock('@stores/settlementPaymentsStore', () => ({
  useSettlementPaymentsStore: (sel: (s: unknown) => unknown): unknown =>
    sel({ payments: [], recordPayment: mockRecord }),
}));
// Maya is owed 300: Dana owes 170, Tom owes 130.
jest.mock('@hooks/useHouseMoney', () => ({
  useHouseMoney: (): { net: Map<string, number> } => ({
    net: new Map([
      ['maya', 300],
      ['dana', -170],
      ['tom', -130],
    ]),
  }),
}));
jest.mock('@hooks/useMemberName', () => ({
  useMemberName:
    (): ((id: string) => string) =>
    (id: string): string =>
      id,
}));

import { useRecordPaymentForm } from '@hooks/useRecordPaymentForm';

const plan = [
  { from: 'dana', to: 'maya', amount: 170 },
  { from: 'tom', to: 'maya', amount: 130 },
];

function setup(): ReturnType<typeof renderHook<ReturnType<typeof useRecordPaymentForm>, unknown>> {
  return renderHook(() =>
    useRecordPaymentForm({
      visible: true,
      plan,
      peopleIds: ['maya', 'dana', 'tom'],
      onDone: jest.fn(),
    })
  );
}

describe('useRecordPaymentForm — a settle-up only goes down to zero', () => {
  it('starts from what is owed, which can be saved', () => {
    const { result } = setup();
    expect(result.current.from).toBe('dana');
    expect(result.current.to).toBe('maya');
    expect(result.current.amount).toBe('170.00');
    expect(result.current.maxSettle).toBe(170);
    expect(result.current.tooMuch).toBe(false);
    expect(result.current.canSave).toBe(true);
  });

  it('allows part of the debt', () => {
    const { result } = setup();
    act(() => result.current.setAmount('50'));
    expect(result.current.tooMuch).toBe(false);
    expect(result.current.canSave).toBe(true);
  });

  it('refuses more than what is owed', () => {
    const { result } = setup();
    act(() => result.current.setAmount('170.01'));
    expect(result.current.tooMuch).toBe(true);
    expect(result.current.canSave).toBe(false);
  });

  it('refuses any amount when nothing is owed in that direction', () => {
    const { result } = setup();
    act(() => {
      result.current.setFrom('maya');
      result.current.setTo('dana');
    });
    act(() => result.current.setAmount('10'));
    expect(result.current.maxSettle).toBe(0);
    expect(result.current.tooMuch).toBe(true);
    expect(result.current.canSave).toBe(false);
  });

  it('never saves when the amount is too much, even if Save is pressed', () => {
    const { result } = setup();
    act(() => result.current.setAmount('5000'));
    act(() => result.current.save());
    expect(mockRecord).not.toHaveBeenCalled();
  });
});
