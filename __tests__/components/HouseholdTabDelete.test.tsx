/**
 * QA — recurring bills: delete needs confirmation
 *
 * Any housemate can delete a recurring bill or a logged payment, so a single tap
 * must never delete straight away. These tests pin the "are you sure?" step:
 * tapping delete only opens the confirmation, and nothing is removed until the
 * destructive button is pressed.
 */

import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import { useRecurringBillsStore } from '@stores/recurringBillsStore';
import { Alert } from '@lib/alert';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: (): null => null }));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string; i18n: { language: string } } => ({
    t: (key: string): string => key,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel({ profile: { id: 'me', name: 'Me' }, houseId: 'h1' }),
    { getState: () => ({ houseId: 'h1' }) }
  ),
}));
jest.mock('@stores/housematesStore', () => ({
  useHousematesStore: (sel: (s: unknown) => unknown): unknown =>
    sel({ housemates: [{ id: 'me', name: 'Me' }], formerMembers: [] }),
}));
jest.mock('@stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: unknown) => unknown): unknown => sel({ currency: '₪' }),
}));

type AlertButton = { text: string; style?: string; onPress?: () => void };
const alertMock = Alert.alert as jest.Mock;

// The delete runs async after confirming; let it settle inside act().
async function pressDestructive(): Promise<void> {
  const buttons = alertMock.mock.calls[0][2] as AlertButton[];
  await act(async () => {
    buttons.find((b) => b.style === 'destructive')?.onPress?.();
  });
}

describe('HouseholdTab — delete confirmation', () => {
  const deleteBill = jest.fn(() => Promise.resolve());
  const deletePayment = jest.fn(() => Promise.resolve());

  beforeEach(() => {
    jest.clearAllMocks();
    useRecurringBillsStore.setState({
      bills: [
        {
          id: 'b1',
          name: 'Internet',
          assignedTo: 'me',
          frequency: 'monthly',
          typicalAmount: 80,
          icon: 'wifi-outline',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      payments: [{ id: 'p1', billId: 'b1', amount: 80, paidAt: '2026-09-24', note: '' }],
      history: [],
      isLoading: false,
      error: null,
      deleteBill,
      deletePayment,
    });
  });

  it('asks before deleting a bill, and only deletes after confirming', async () => {
    render(<HouseholdTab />);

    fireEvent.press(screen.getByLabelText('bills.delete_bill'));

    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(deleteBill).not.toHaveBeenCalled();

    await pressDestructive();
    expect(deleteBill).toHaveBeenCalledWith('b1');
  });

  it('asks before deleting a payment, and only deletes after confirming', async () => {
    render(<HouseholdTab />);

    fireEvent.press(screen.getByLabelText('bills.household_history'));
    fireEvent.press(screen.getByLabelText('bills.delete_payment'));

    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(deletePayment).not.toHaveBeenCalled();

    await pressDestructive();
    expect(deletePayment).toHaveBeenCalledWith('p1');
  });

  it('keeps the bill when the confirmation is cancelled', () => {
    render(<HouseholdTab />);

    fireEvent.press(screen.getByLabelText('bills.delete_bill'));
    const buttons = alertMock.mock.calls[0][2] as AlertButton[];
    buttons.find((b) => b.style === 'cancel')?.onPress?.();

    expect(deleteBill).not.toHaveBeenCalled();
  });
});
