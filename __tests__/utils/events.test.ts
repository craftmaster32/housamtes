import { isEventImminent } from '@utils/events';

describe('isEventImminent', () => {
  // Fixed reference point: Mon 20 Jul 2026, 15:00 local time.
  const now = new Date('2026-07-20T15:00:00');

  it('flags an event happening later today', () => {
    expect(isEventImminent({ date: '2026-07-20', startTime: '19:00' }, now)).toBe(true);
  });

  it('flags an all-day event today even with no start time', () => {
    expect(isEventImminent({ date: '2026-07-20' }, now)).toBe(true);
  });

  it('flags an event earlier today whose time has already passed', () => {
    expect(isEventImminent({ date: '2026-07-20', startTime: '09:00' }, now)).toBe(true);
  });

  it('flags an event tomorrow morning that is within 24 hours', () => {
    expect(isEventImminent({ date: '2026-07-21', startTime: '10:00' }, now)).toBe(true);
  });

  it('does not flag an event tomorrow evening that is more than 24 hours away', () => {
    expect(isEventImminent({ date: '2026-07-21', startTime: '20:00' }, now)).toBe(false);
  });

  it('treats a tomorrow all-day event (midnight start) as within 24 hours', () => {
    expect(isEventImminent({ date: '2026-07-21' }, now)).toBe(true);
  });

  it('does not flag an event several days out', () => {
    expect(isEventImminent({ date: '2026-07-25', startTime: '10:00' }, now)).toBe(false);
  });
});
