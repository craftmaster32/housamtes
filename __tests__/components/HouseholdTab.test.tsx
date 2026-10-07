/**
 * QA — recurring bills tab
 *
 * Pins the redesigned cards: status comes from what payments cover (not when
 * they were paid), overdue bills sort first, logging a payment prefills the next
 * unpaid period, and deleting a bill or payment always asks first — any
 * housemate can delete, so a single tap must never remove anything.
 */

import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { HouseholdTab } from '@components/bills/HouseholdTab';
import {
  useRecurringBillsStore,
  type HouseholdPayment,
  type RecurringBill,
} from '@stores/recurringBillsStore';
import { Alert } from '@lib/alert';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: (): null => null }));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));
// Keys come back as-is, with any interpolation values appended, so tests can
// check both which string is shown and what was filled into it.
jest.mock('react-i18next', () => ({
  useTranslation: (): {
    t: (key: string, params?: Record<string, unknown>) => string;
    i18n: { language: string };
  } => ({
    t: (key: string, params?: Record<string, unknown>): string =>
      params ? `${key} ${JSON.stringify(params)}` : key,
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
    sel({
      housemates: [
        { id: 'me', name: 'Me' },
        { id: 'dana', name: 'Dana' },
      ],
      formerMembers: [],
    }),
}));
jest.mock('@stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: unknown) => unknown): unknown => sel({ currency: '₪' }),
}));

type AlertButton = { text: string; style?: string; onPress?: () => void };
const alertMock = Alert.alert as jest.Mock;

async function pressDestructive(): Promise<void> {
  const buttons = alertMock.mock.calls[0][2] as AlertButton[];
  await act(async () => {
    buttons.find((b) => b.style === 'destructive')?.onPress?.();
  });
}

const bill = (over: Partial<RecurringBill>): RecurringBill => ({
  id: 'b',
  name: 'Bill',
  assignedTo: 'me',
  frequency: 'monthly',
  typicalAmount: 100,
  icon: 'receipt-outline',
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const arnona = bill({ id: 'arnona', name: 'ארנונה', frequency: 'bimonthly', typicalAmount: 1180 });
const vaad = bill({ id: 'vaad', name: 'ועד בית', frequency: 'quarterly', assignedTo: 'dana' });
const payments: HouseholdPayment[] = [
  {
    id: 'a1',
    billId: 'arnona',
    amount: 1180,
    paidAt: '2026-07-03',
    note: 'יולי-אוג',
    coverageStart: '2026-07-01',
    coverageMonths: 2,
  },
  {
    id: 'v1',
    billId: 'vaad',
    amount: 450,
    paidAt: '2026-10-02',
    note: '',
    coverageStart: '2026-10-01',
    coverageMonths: 3,
    paidBy: 'dana',
  },
];

const deleteBill = jest.fn(() => Promise.resolve());
const deletePayment = jest.fn(() => Promise.resolve());
const logPayment = jest.fn((p: Omit<HouseholdPayment, 'id'>) => {
  useRecurringBillsStore.setState((s) => ({ payments: [{ ...p, id: 'new' }, ...s.payments] }));
  return Promise.resolve();
});

beforeAll(() => {
  // Freeze "today" only — real timers keep async work flowing.
  jest.useFakeTimers({
    now: new Date('2026-10-07T12:00:00'),
    doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'nextTick', 'queueMicrotask'],
  });
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  jest.clearAllMocks();
  useRecurringBillsStore.setState({
    // ועד בית listed first on purpose — ארנונה is overdue and must sort above it.
    bills: [vaad, arnona],
    payments,
    history: [],
    isLoading: false,
    error: null,
    deleteBill,
    deletePayment,
    logPayment,
  });
});

describe('recurring bill cards', () => {
  it('shows coverage-based status for ארנונה (every 2 months) and ועד בית (every 3 months)', () => {
    render(<HouseholdTab />);

    // ארנונה: paid Jul–Aug → Sep–Oct is due since 1 Sep, 36 days overdue.
    expect(screen.getByText('bills.recurring_covered_through {"month":"Aug 2026"}')).toBeTruthy();
    expect(screen.getByText('bills.recurring_not_paid_yet {"period":"Sep–Oct 2026"}')).toBeTruthy();
    expect(screen.getByText('bills.recurring_overdue_days {"count":36}')).toBeTruthy();
    expect(screen.getByText('bills.recurring_log_period {"period":"Sep–Oct"}')).toBeTruthy();

    // ועד בית: paid Oct–Dec → next due 1 Jan, in 86 days.
    expect(screen.getByText('bills.recurring_covered_through {"month":"Dec 2026"}')).toBeTruthy();
    expect(screen.getByText('bills.recurring_next_due {"date":"1 Jan"}')).toBeTruthy();
    expect(screen.getByText('bills.recurring_in_days {"count":86}')).toBeTruthy();
  });

  it('shows amount, frequency and payer on one line', () => {
    render(<HouseholdTab />);
    expect(screen.getByText('₪1180 · bills.recurring_every_n {"n":2} · Me')).toBeTruthy();
  });

  it('sorts overdue bills first', () => {
    render(<HouseholdTab />);
    const names = screen.getAllByText(/^(ארנונה|ועד בית)$/).map((n) => n.props.children);
    expect(names).toEqual(['ארנונה', 'ועד בית']);
  });

  it('logs a payment for the prefilled next period and updates the card', async () => {
    render(<HouseholdTab />);

    fireEvent.press(screen.getByText('bills.recurring_log_period {"period":"Sep–Oct"}'));
    // The sheet opens on the next unpaid period, with the bill's amount and payer.
    expect(screen.getByLabelText('bills.recurring_period_covered: Sep–Oct 2026')).toBeTruthy();
    expect(screen.getByDisplayValue('1180')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('bills.recurring_save_payment'));
    });

    expect(logPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        billId: 'arnona',
        amount: 1180,
        paidAt: '2026-10-07',
        coverageStart: '2026-09-01',
        coverageMonths: 2,
        paidBy: 'me',
      }),
      'h1'
    );
    expect(screen.getByText('bills.recurring_covered_through {"month":"Oct 2026"}')).toBeTruthy();
    expect(screen.getByText('bills.recurring_log_period {"period":"Nov–Dec"}')).toBeTruthy();
  });

  it('flags a period logged twice in the history', () => {
    useRecurringBillsStore.setState({
      payments: [...payments, { ...payments[0], id: 'a2', paidAt: '2026-07-20' }],
    });
    render(<HouseholdTab />);

    fireEvent.press(screen.getAllByText('bills.recurring_history')[0]);
    expect(screen.getAllByText('bills.recurring_duplicate')).toHaveLength(2);
    expect(screen.getByText('bills.recurring_hide')).toBeTruthy();
  });

  it('names a legacy payment with unknown coverage by its note', () => {
    useRecurringBillsStore.setState({
      payments: [{ id: 'old', billId: 'vaad', amount: 450, paidAt: '2026-04-02', note: 'רבעון' }],
    });
    render(<HouseholdTab />);

    fireEvent.press(screen.getByText('bills.recurring_history'));
    expect(screen.getByText('רבעון')).toBeTruthy();
    expect(screen.getByText('bills.recurring_paid_on_date {"date":"2 Apr"}')).toBeTruthy();
  });
});

describe('delete confirmation', () => {
  it('asks before deleting a bill from the ⋯ menu, and only deletes after confirming', async () => {
    render(<HouseholdTab />);

    fireEvent.press(screen.getByLabelText('bills.recurring_menu_label {"name":"ארנונה"}'));
    fireEvent.press(screen.getByLabelText('bills.recurring_menu_delete'));

    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(deleteBill).not.toHaveBeenCalled();

    await pressDestructive();
    expect(deleteBill).toHaveBeenCalledWith('arnona');
  });

  it('keeps the bill when the confirmation is cancelled', () => {
    render(<HouseholdTab />);

    fireEvent.press(screen.getByLabelText('bills.recurring_menu_label {"name":"ארנונה"}'));
    fireEvent.press(screen.getByLabelText('bills.recurring_menu_delete'));
    const buttons = alertMock.mock.calls[0][2] as AlertButton[];
    const cancelButton = buttons.find((b) => b.text === 'common.cancel' && b.style === 'cancel');
    expect(cancelButton).toBeDefined();
    cancelButton?.onPress?.();

    expect(deleteBill).not.toHaveBeenCalled();
  });

  it('opens a payment from its history row and asks before deleting it', async () => {
    render(<HouseholdTab />);

    fireEvent.press(screen.getAllByText('bills.recurring_history')[0]);
    fireEvent.press(screen.getByText('Jul–Aug 2026'));
    // Only the tapped payment's edit sheet is open.
    expect(screen.getByText('bills.edit_payment')).toBeTruthy();
    fireEvent.press(screen.getByText('bills.delete_payment'));

    expect(alertMock).toHaveBeenCalledTimes(1);
    expect(deletePayment).not.toHaveBeenCalled();

    await pressDestructive();
    expect(deletePayment).toHaveBeenCalledWith('a1');
  });
});
