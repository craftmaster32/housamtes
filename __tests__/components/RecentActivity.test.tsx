/**
 * Recent activity on Profile: bills store people by user id, so "paid by you"
 * and your share must be matched by id, and other payers shown by name.
 */
import { render, screen } from '@testing-library/react-native';
import { RecentActivity } from '@components/profile/RecentActivity';
import type { Bill } from '@stores/billsStore';

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
    sel({
      housemates: [
        { id: 'me', name: 'Lior' },
        { id: 'u2', name: 'Dana' },
      ],
      formerMembers: [],
    }),
}));
jest.mock('@stores/settingsStore', () => ({
  useSettingsStore: (sel: (s: unknown) => unknown): unknown => sel({ currency: '£' }),
}));

const bill = (over: Partial<Bill>): Bill =>
  ({
    id: 'b1',
    title: 'Groceries',
    amount: 60,
    paidBy: 'u2',
    splitBetween: ['me', 'u2', 'u3'],
    splitAmounts: null,
    date: '2026-10-24',
    category: 'groceries',
    ...over,
  }) as Bill;

describe('RecentActivity', () => {
  it('names the other payer and shows an equal share', () => {
    render(<RecentActivity today={[bill({})]} yesterday={[]} userId="me" onMore={jest.fn()} />);
    expect(screen.getByText('profile.paid_by_name {"name":"Dana"}')).toBeTruthy();
    expect(screen.getByText('-£20.00')).toBeTruthy();
  });

  it('says you paid and uses your custom split amount', () => {
    render(
      <RecentActivity
        today={[]}
        yesterday={[bill({ paidBy: 'me', splitAmounts: { me: 35, u2: 25 } })]}
        userId="me"
        onMore={jest.fn()}
      />
    );
    expect(screen.getByText('profile.paid_by_you')).toBeTruthy();
    expect(screen.getByText('-£35.00')).toBeTruthy();
  });
});
