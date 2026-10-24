/**
 * useParkingActions — tapping the spot quickly. While a claim or release is
 * still saving, further taps only flip what the spot should end up as; the
 * spot then catches up to the last tap instead of failing.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useParkingActions } from '@hooks/useParkingActions';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({ t: (key: string): string => key }),
}));

interface Session {
  id: string;
  occupant: string;
  startTime: string;
}

// A tiny stand-in for the parking store: claim/release take a moment to save.
const mockState: { current: Session | null } = { current: null };
const mockClaim = jest.fn(async (userId: string): Promise<void> => {
  mockState.current = { id: 'optimistic', occupant: userId, startTime: '' };
  await new Promise((r) => setTimeout(r, 20));
  mockState.current = { id: 's1', occupant: userId, startTime: '' };
});
const mockRelease = jest.fn(async (): Promise<void> => {
  mockState.current = null;
  await new Promise((r) => setTimeout(r, 20));
});
const mockStore = {
  get current(): Session | null {
    return mockState.current;
  },
  reservations: [],
  claim: mockClaim,
  release: mockRelease,
  cancelReservation: jest.fn(),
  voteOnReservation: jest.fn(),
  clearHistoryItem: jest.fn(),
  clearAllHistory: jest.fn(),
  checkReservationAutoApply: jest.fn(),
};

jest.mock('@stores/parkingStore', () => {
  const useParkingStore = (sel: (s: typeof mockStore) => unknown): unknown => sel(mockStore);
  useParkingStore.getState = (): typeof mockStore => mockStore;
  return { useParkingStore };
});
jest.mock('@stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown): unknown =>
    sel({ profile: { id: 'me', name: 'Lior' }, houseId: '' }),
}));
jest.mock('@stores/housematesStore', () => ({
  useHousematesStore: (sel: (s: unknown) => unknown): unknown => sel({ housemates: [] }),
}));
jest.mock('@stores/calendarSyncStore', () => ({
  useCalendarSyncStore: (sel: (s: unknown) => unknown): unknown =>
    sel({
      syncParkingApproved: jest.fn(() => Promise.resolve()),
      removeCalendarEvent: jest.fn(() => Promise.resolve()),
    }),
}));

// Let any claim / release still "saving" finish before the next test starts —
// otherwise its catch-up step could act on the next test's spot.
const settle = (): Promise<void> => act(() => new Promise((r) => setTimeout(r, 100)));

beforeEach(() => {
  mockState.current = null;
  mockClaim.mockClear();
  mockRelease.mockClear();
});

describe('useParkingActions — quick taps on the spot', () => {
  it('claims then releases when tapped twice quickly', async () => {
    const { result } = renderHook(() => useParkingActions());
    act(() => {
      result.current.handleSpotPress();
      result.current.handleSpotPress();
    });
    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await settle();
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockState.current).toBeNull();
    expect(result.current.error).toBe('');
  });

  it('ends parked after three quick taps, without an extra release', async () => {
    const { result } = renderHook(() => useParkingActions());
    act(() => {
      result.current.handleSpotPress();
      result.current.handleSpotPress();
      result.current.handleSpotPress();
    });
    await waitFor(() => expect(mockState.current?.id).toBe('s1'), { timeout: 3000 });
    await settle();
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockState.current?.occupant).toBe('me');
  });
});
