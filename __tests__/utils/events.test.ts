import { isEventImminent, nextOccurrenceOnOrAfter } from '@utils/events';

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

describe('nextOccurrenceOnOrAfter', () => {
  const today = '2026-07-20'; // a Monday

  it('returns a non-recurring event on its own day', () => {
    expect(nextOccurrenceOnOrAfter({ date: '2026-07-22' }, today)).toBe('2026-07-22');
  });

  it('returns undefined for a passed non-recurring event', () => {
    expect(nextOccurrenceOnOrAfter({ date: '2026-07-10' }, today)).toBeUndefined();
  });

  it('advances a weekly event whose base date is in the past to its next occurrence', () => {
    // Base three weeks ago on a Monday → next Monday on/after today is today.
    expect(nextOccurrenceOnOrAfter({ date: '2026-06-29', recurrence: 'weekly' }, today)).toBe(
      '2026-07-20'
    );
  });

  it('advances a weekly event to the upcoming weekday when today is not it', () => {
    // Base was a Wednesday → next Wednesday on/after Mon 20 Jul is Wed 22 Jul.
    expect(nextOccurrenceOnOrAfter({ date: '2026-07-01', recurrence: 'weekly' }, today)).toBe(
      '2026-07-22'
    );
  });

  it('advances a monthly event to the same day next month', () => {
    expect(nextOccurrenceOnOrAfter({ date: '2026-05-25', recurrence: 'monthly' }, today)).toBe(
      '2026-07-25'
    );
  });

  it('advances a yearly event to this year’s occurrence', () => {
    expect(nextOccurrenceOnOrAfter({ date: '2020-08-15', recurrence: 'yearly' }, today)).toBe(
      '2026-08-15'
    );
  });

  it('returns undefined once the recurrence end date has passed', () => {
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-06-01', recurrence: 'weekly', recurrenceEnd: '2026-07-01' },
        today
      )
    ).toBeUndefined();
  });
});
