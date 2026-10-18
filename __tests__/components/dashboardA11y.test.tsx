/**
 * QA — home screen controls stay reachable by screen readers
 *
 * In React Native a pressable is an accessibility element by default and swallows
 * everything inside it, so a button nested in another button can't be focused by
 * VoiceOver/TalkBack. These tests pin that the money card's spending-chart button
 * and the card-picker's pin button are siblings of their neighbours, not children.
 */

import { render, screen, within } from '@testing-library/react-native';
import { OwedHero } from '@components/dashboard/OwedHero';
import { DashboardCardsSheet } from '@components/dashboard/DashboardCardsSheet';
import { useDashboardCardsStore } from '@stores/dashboardCardsStore';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@stores/navigationStore', () => ({ navigateToBase: jest.fn() }));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({ t: (key: string): string => key }),
}));

describe('OwedHero accessibility', () => {
  it('keeps the spending chart button outside the balance button', () => {
    render(<OwedHero />);
    // No bills in the mocked stores, so the card shows the settled state.
    const balance = screen.getByLabelText('dashboard.balance_all_settled');
    expect(screen.getByLabelText('spending.view_spending')).toBeTruthy();
    expect(within(balance).queryByLabelText('spending.view_spending')).toBeNull();
  });
});

describe('DashboardCardsSheet accessibility', () => {
  beforeEach(() => {
    useDashboardCardsStore.setState({ enabled: ['parking'], pinned: null });
  });

  it('keeps the pin button outside the on/off switch', () => {
    render(<DashboardCardsSheet visible onClose={jest.fn()} />);
    const parkingSwitch = screen.getByRole('switch', { name: 'dashboard.parking_label' });
    expect(screen.getByLabelText('dashboard.pin_left')).toBeTruthy();
    expect(within(parkingSwitch).queryByLabelText('dashboard.pin_left')).toBeNull();
  });
});
