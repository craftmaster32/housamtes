/**
 * QA — BottomTabBar parking quick-toggle
 *
 * The parking tab is special: tapping it must CLAIM/RELEASE the spot in place,
 * never navigate to the parking page (that entry point is the dashboard card).
 * These tests pin that behaviour so a future refactor can't silently turn the
 * car icon back into a navigation tab.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { BottomTabBar } from '../../components/shared/BottomTabBar';
import { navigateToBase } from '@stores/navigationStore';
import { useParkingStore } from '@stores/parkingStore';

// ── Native / animation deps stubbed to plain views and no-op hooks ─────────────
/* eslint-disable @typescript-eslint/no-var-requires */
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Animated = { View: (props: Record<string, unknown>) => React.createElement(View, props) };
  return {
    __esModule: true,
    default: Animated,
    FadeIn: { duration: () => ({}) },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: unknown) => v,
  };
});
/* eslint-enable @typescript-eslint/no-var-requires */
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  usePathname: () => '/(tabs)/dashboard',
}));
jest.mock('@stores/navigationStore', () => ({ navigateToBase: jest.fn() }));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));

// ── i18n: return the provided English default (2nd arg) or the key ─────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, def?: unknown) => (typeof def === 'string' ? def : key),
  }),
}));

// ── Colours: only the tokens the bar reads ─────────────────────────────────────
jest.mock('@hooks/useColors', () => ({
  useColors: () => ({
    background: '#fff',
    border: '#eee',
    primary: '#4F78B6',
    textSecondary: '#888',
    danger: '#d00',
    white: '#fff',
    surface: '#fafafa',
  }),
}));

// ── Popup stores ───────────────────────────────────────────────────────────────
jest.mock('@stores/morePopupStore', () => ({
  useMorePopupStore: (sel: (s: unknown) => unknown) =>
    sel({ isOpen: false, open: jest.fn(), close: jest.fn() }),
}));
jest.mock('@stores/profilePopupStore', () => ({
  useProfilePopupStore: (sel: (s: unknown) => unknown) => sel({ close: jest.fn() }),
}));

// ── Feature stores (only the slices the bar selects) ───────────────────────────
jest.mock('@stores/billsStore', () => ({
  useBillsStore: (sel: (s: unknown) => unknown) => sel({ bills: [] }),
}));
jest.mock('@stores/badgeStore', () => ({
  useBadgeStore: (sel: (s: unknown) => unknown) => sel({ lastSeen: {} }),
  countNew: () => 0,
  countNewSimple: () => 0,
}));
jest.mock('@stores/groceryStore', () => ({
  useGroceryStore: (sel: (s: unknown) => unknown) => sel({ items: [] }),
}));
jest.mock('@stores/choresStore', () => ({
  useChoresStore: (sel: (s: unknown) => unknown) => sel({ chores: [] }),
}));
jest.mock('@stores/votingStore', () => ({
  useVotingStore: (sel: (s: unknown) => unknown) => sel({ proposals: [] }),
}));
jest.mock('@stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ profile: { id: 'me', name: 'Me' }, houseId: 'h1' }),
}));
jest.mock('@stores/housematesStore', () => ({
  useHousematesStore: (sel: (s: unknown) => unknown) => sel({ housemates: [] }),
}));

// ── Parking store: hook-with-selector plus getState(), with a settable current ──
jest.mock('@stores/parkingStore', () => {
  const state: Record<string, unknown> = {
    current: null,
    reservations: [],
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

describe('BottomTabBar — parking tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    parking.__set({ current: null });
  });

  it('claims the free spot on tap instead of navigating', () => {
    render(<BottomTabBar />);
    fireEvent.press(screen.getByLabelText('Claim parking spot'));
    expect(parking.getState().claim).toHaveBeenCalledTimes(1);
    expect(navigateToBase).not.toHaveBeenCalled();
  });

  it('releases the spot when it is mine, still without navigating', () => {
    parking.__set({ current: { id: 's1', occupant: 'me', startTime: '' } });
    render(<BottomTabBar />);
    fireEvent.press(screen.getByLabelText('Release parking spot'));
    expect(parking.getState().release).toHaveBeenCalledTimes(1);
    expect(navigateToBase).not.toHaveBeenCalled();
  });

  it('gates a housemate-held spot behind a confirmation (no immediate release)', () => {
    parking.__set({ current: { id: 's2', occupant: 'other', startTime: '' } });
    render(<BottomTabBar />);
    // Label reflects a claim action; the confirm gate lives inside the handler.
    fireEvent.press(screen.getByLabelText('Claim parking spot'));
    expect(parking.getState().release).not.toHaveBeenCalled();
    expect(navigateToBase).not.toHaveBeenCalled();
  });

  it('still navigates for a normal tab (bills)', () => {
    render(<BottomTabBar />);
    fireEvent.press(screen.getByLabelText('nav.bills'));
    expect(navigateToBase).toHaveBeenCalledWith('/(tabs)/bills');
  });
});
