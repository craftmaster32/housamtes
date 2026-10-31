import {
  byStartTime,
  formatSince,
  parseDateParts,
  timeRange,
  toDateString,
} from '@utils/parkingDates';
import { reservationStatus } from '@components/parking/reservationStatus';
import type { ParkingReservation } from '@stores/parkingStore';

jest.mock('@lib/supabase', () => ({ supabase: {} }));

const res = (over: Partial<ParkingReservation>): ParkingReservation => ({
  id: 'r',
  requestedBy: 'u',
  date: '2026-10-22',
  note: '',
  status: 'pending',
  createdAt: '',
  votes: [],
  ...over,
});
const t = (key: string): string => key;

describe('parkingDates', () => {
  describe('formatSince', () => {
    const now = new Date(2026, 9, 31, 12, 27);
    const at = (d: number, h: number, m: number): string =>
      new Date(2026, 9, d, h, m).toISOString();

    it('shows just the time when parked today', () => {
      expect(formatSince(at(31, 9, 5), 'en-US', 'yesterday', now)).toMatch(/^09:05/);
    });

    it('says yesterday when parked the day before', () => {
      expect(formatSince(at(30, 13, 23), 'en-US', 'yesterday', now)).toMatch(/^yesterday 01:23/);
    });

    it('shows the date when parked further back', () => {
      expect(formatSince(at(28, 8, 0), 'en-US', 'yesterday', now)).toMatch(/^Wed, Oct 28, 08:00/);
    });
  });

  it('formats a local date as YYYY-MM-DD', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('splits a date into day, month and weekday', () => {
    const parts = parseDateParts('2026-10-22', 'en-US');
    expect(parts.dayNum).toBe('22');
    expect(parts.monthAbbr).toBe('OCT');
    expect(parts.weekdayFull).toBe('Thursday');
    expect(parts.weekdayShort).toBe('THU');
  });

  it('shows a time range, a start only, or nothing for all day', () => {
    expect(timeRange({ startTime: '09:00', endTime: '13:00' })).toBe('09:00 – 13:00');
    expect(timeRange({ startTime: '09:00' })).toBe('09:00');
    expect(timeRange({})).toBeNull();
  });

  it('sorts timed reservations by start and puts all-day ones last', () => {
    const list = [
      res({ id: 'all' }),
      res({ id: 'late', startTime: '18:00' }),
      res({ id: 'early', startTime: '08:00' }),
    ];
    expect(list.sort(byStartTime).map((r) => r.id)).toEqual(['early', 'late', 'all']);
  });
});

describe('reservationStatus', () => {
  const before = new Date(2026, 9, 21, 12, 0);
  const after = new Date(2026, 9, 23, 12, 0);

  it('stamps approved and rejected reservations', () => {
    expect(reservationStatus(res({ status: 'approved' }), before, t).label).toBe(
      '✓ parking.approved'
    );
    expect(reservationStatus(res({ status: 'rejected' }), before, t).label).toBe(
      'parking.rejected'
    );
  });

  it('says pending until the slot starts, then voting closed', () => {
    expect(reservationStatus(res({}), before, t)).toMatchObject({
      label: 'parking.pending',
      votingClosed: false,
    });
    expect(reservationStatus(res({}), after, t)).toMatchObject({
      label: 'parking.voting_closed',
      votingClosed: true,
    });
  });
});
