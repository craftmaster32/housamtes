/**
 * QA — home screen "coming up" tickets
 *
 * Today's and tomorrow's plans show as tickets: the day and time on the stub,
 * the title (and any note) on the main part. Tapping an event opens the
 * calendar; a parking request opens parking.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { HappeningNow } from '@components/dashboard/HappeningNow';
import { navigateToBase } from '@stores/navigationStore';

const mockState: { events: unknown[]; reservations: unknown[]; activeRun: unknown } = {
  events: [],
  reservations: [],
  activeRun: null,
};

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@stores/navigationStore', () => ({ navigateToBase: jest.fn() }));
jest.mock('@hooks/useReduceMotion', () => ({ useReduceMotion: (): boolean => true }));
jest.mock('@hooks/useHeadingFont', () => ({ useHeadingFont: (): object => ({}) }));
jest.mock('@stores/eventsStore', () => ({
  useEventsStore: (sel: (s: unknown) => unknown): unknown => sel(mockState),
}));
jest.mock('@stores/groceryStore', () => ({
  useGroceryStore: (sel: (s: unknown) => unknown): unknown => sel(mockState),
}));
jest.mock('@stores/parkingStore', () => ({
  useParkingStore: (sel: (s: unknown) => unknown): unknown => sel(mockState),
}));
jest.mock('@hooks/useMemberName', () => ({
  useMemberName: (): ((id: string) => string) => (): string => 'Maya Cohen',
}));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string, opts?: { name?: string }) => string } => ({
    t: (key: string, opts?: { name?: string }): string =>
      opts?.name ? `${key}:${opts.name}` : key,
  }),
}));

function ymd(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

describe('HappeningNow tickets', () => {
  // Midday, so "tomorrow 07:00" is always within the next 24 hours.
  beforeAll(() => jest.useFakeTimers({ now: new Date(2026, 9, 19, 12, 0) }));
  afterAll(() => jest.useRealTimers());
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.events = [];
    mockState.reservations = [];
    mockState.activeRun = null;
  });

  it('shows nothing when there are no plans', () => {
    render(<HappeningNow />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('puts the day and time on the stub and the note under the title', () => {
    mockState.events = [
      { id: 'e1', title: 'Recycling pickup', date: ymd(1), startTime: '07:00', notes: 'Blue bins' },
    ];
    render(<HappeningNow />);
    expect(screen.getByText('common.tomorrow')).toBeTruthy();
    expect(screen.getByText('07:00')).toBeTruthy();
    expect(screen.getByText('Recycling pickup')).toBeTruthy();
    expect(screen.getByText('Blue bins')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(navigateToBase).toHaveBeenCalledWith('/(tabs)/calendar');
  });

  it('shows a parking request as a ticket that opens parking', () => {
    mockState.reservations = [{ id: 'r1', requestedBy: 'u2', date: ymd(1), status: 'pending' }];
    render(<HappeningNow />);
    expect(screen.getByText('happening.parking_requested:Maya')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(navigateToBase).toHaveBeenCalledWith('/(tabs)/parking');
  });

  it('shows a live shopping run as "now"', () => {
    mockState.activeRun = { shopperName: 'Noam Levi', shopperId: 'u3', startedAt: '' };
    render(<HappeningNow />);
    expect(screen.getByText('happening.now')).toBeTruthy();
    expect(screen.getByText('happening.shopping_now:Noam')).toBeTruthy();
  });
});
