/**
 * Splitwise-style split sentence: equal split is the default and shows each
 * person's share; tapping either chip opens the full split options.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SplitSummary } from '@components/bills/form/SplitSummary';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: (): null => null }));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string, params?: Record<string, unknown>) => string } => ({
    t: (key: string, params?: Record<string, unknown>): string =>
      params ? `${key} ${JSON.stringify(params)}` : key,
  }),
}));
jest.mock('@stores/housematesStore', () => ({
  useHousematesStore: (sel: (s: unknown) => unknown): unknown =>
    sel({ housemates: [{ id: 'm', name: 'Maya Cohen' }] }),
}));

const base = {
  payerId: 'm',
  payerName: 'Maya',
  peopleCount: 3,
  totalAmount: 286.4,
  currencyCode: 'ILS',
};

describe('SplitSummary', () => {
  it('reads "Paid by Maya and split equally" with each share', () => {
    render(<SplitSummary {...base} splitType="equal" onOpen={jest.fn()} />);
    expect(screen.getByText('Maya')).toBeTruthy();
    expect(screen.getByText('bills.split_equally')).toBeTruthy();
    expect(screen.getByText(/bills\.split_each_people .*"count":3/)).toBeTruthy();
  });

  it('names a custom split and stops showing a per-person amount', () => {
    render(<SplitSummary {...base} splitType="custom" onOpen={jest.fn()} />);
    expect(screen.getByText('bills.split_by_amounts')).toBeTruthy();
    expect(screen.getByText('bills.split_between_people {"count":3}')).toBeTruthy();
  });

  it('opens the split options from either chip', () => {
    const onOpen = jest.fn();
    render(<SplitSummary {...base} splitType="equal" onOpen={onOpen} />);
    fireEvent.press(screen.getByLabelText('bills.paid_by Maya'));
    fireEvent.press(screen.getByLabelText('bills.split_and_split bills.split_equally'));
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
