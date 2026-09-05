/**
 * QA — dashboard ParkingCard quick-toggle
 *
 * The dashboard parking card catches/releases the spot in place: claim a free
 * spot, release your own, or confirm before freeing a housemate's. It must NOT
 * navigate — the full parking page is opened from the bottom bar's car icon.
 * These tests pin that so the card can't silently revert to a navigation link.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { ParkingCard } from '@components/dashboard/DashboardCarousel';
import { navigateToBase } from '@stores/navigationStore';
import { useParkingStore } from '@stores/parkingStore';
import { Alert } from '@lib/alert';

// Native-only deps rendered as nothing.
jest.mock('react-native-svg', () => {
  const Empty = (): null => null;
  return {
    __esModule: true,
    default: Empty,
    Circle: Empty,
    Path: Empty,
    Defs: Empty,
    LinearGradient: Empty,
    Stop: Empty,
    Mask: Empty,
    Rect: Empty,
  };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: (): null => null }));
// Sibling cards' stores import the Supabase client at module load; stub it so
// importing the carousel module doesn't require real env vars.
jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: (): null => null }));
jest.mock('@stores/navigationStore', () => ({ navigateToBase: jest.fn() }));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('@lib/i18n', () => ({ isRTL: () => false }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, def?: unknown) => (typeof def === 'string' ? def : key),
  }),
}));

// Only the stores ParkingCard actually reads.
jest.mock('@stores/languageStore', () => ({
  useLanguageStore: (sel: (s: unknown) => unknown) => sel({ language: 'en' }),
}));
jest.mock('@stores/housematesStore', () => ({
  useHousematesStore: (sel: (s: unknown) => unknown) => sel({ housemates: [] }),
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ profile: { id: 'me', name: 'Me' }, houseId: 'h1' }),
}));
jest.mock('@stores/parkingStore', () => {
  const state: Record<string, unknown> = {
    current: null,
    claim: jest.fn(() => Promise.resolve()),
    release: jest.fn(() => Promise.resolve()),
  };
  const hook = (sel: (s: unknown) => unknown): unknown => sel(state);
  hook.getState = (): unknown => state;
  hook.__set = (patch: Record<string, unknown>): void => {
    Object.assign(state, patch);
  };
  return { useParkingStore: hook };
});

type ParkingMock = typeof useParkingStore & {
  getState: () => { claim: jest.Mock; release: jest.Mock };
  __set: (patch: Record<string, unknown>) => void;
};
const parking = useParkingStore as unknown as ParkingMock;
// The card reads style objects by name; undefined entries are harmless in RN.
const styles = {} as never;

describe('ParkingCard — tap to toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    parking.__set({ current: null });
  });

  it('claims the free spot on tap instead of navigating', () => {
    render(<ParkingCard styles={styles} />);
    fireEvent.press(screen.getByLabelText('Claim parking spot'));
    expect(parking.getState().claim).toHaveBeenCalledTimes(1);
    expect(navigateToBase).not.toHaveBeenCalled();
  });

  it('releases the spot when it is mine, still without navigating', () => {
    parking.__set({ current: { id: 's1', occupant: 'me', startTime: '' } });
    render(<ParkingCard styles={styles} />);
    fireEvent.press(screen.getByLabelText('Release parking spot'));
    expect(parking.getState().release).toHaveBeenCalledTimes(1);
    expect(navigateToBase).not.toHaveBeenCalled();
  });

  it('gates a housemate-held spot behind a confirmation (no immediate release)', () => {
    parking.__set({ current: { id: 's2', occupant: 'other', startTime: '' } });
    render(<ParkingCard styles={styles} />);
    fireEvent.press(screen.getByLabelText("Free housemate's parking spot"));
    expect(parking.getState().release).not.toHaveBeenCalled();
    expect(navigateToBase).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as Array<{
      style?: string;
      onPress?: () => void;
    }>;
    const confirmBtn = buttons.find((b) => b.style === 'destructive');
    confirmBtn?.onPress?.();
    expect(parking.getState().release).toHaveBeenCalledTimes(1);
  });
});
