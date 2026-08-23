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

  it('advances a biweekly (every 2 weeks) event by 14-day steps', () => {
    // Base Mon 6 Jul; +14 = Mon 20 Jul is the first occurrence on/after today.
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-07-06', recurrence: 'weekly', recurrenceInterval: 2 },
        today
      )
    ).toBe('2026-07-20');
  });

  it('skips the off-week for a biweekly event', () => {
    // Base Mon 13 Jul, every 2 weeks → 13 Jul, 27 Jul, … so Mon 20 Jul is skipped;
    // next occurrence on/after today (Mon 20 Jul) is Mon 27 Jul.
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-07-13', recurrence: 'weekly', recurrenceInterval: 2 },
        today
      )
    ).toBe('2026-07-27');
  });

  it('advances a daily event with an interval to its next occurrence', () => {
    // Base Fri 17 Jul, every 3 days → 17, 20, … so Mon 20 Jul is on schedule.
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-07-17', recurrence: 'daily', recurrenceInterval: 3 },
        today
      )
    ).toBe('2026-07-20');
  });

  it('advances an every-2-months event over the interval', () => {
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-03-25', recurrence: 'monthly', recurrenceInterval: 2 },
        today
      )
    ).toBe('2026-07-25');
  });

  it('treats a missing interval as 1 (plain weekly)', () => {
    expect(nextOccurrenceOnOrAfter({ date: '2026-06-29', recurrence: 'weekly' }, today)).toBe(
      '2026-07-20'
    );
  });

  it('finds the next day of a weekly multi-day (Mon & Thu) event', () => {
    // Base Mon 20 Jul on [Mon, Thu]; today is Mon 20 → next occurrence is today.
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-07-20', recurrence: 'weekly', recurrenceDays: [1, 4] },
        today
      )
    ).toBe('2026-07-20');
    // From Tue 21 Jul, the next listed day is Thu 23 Jul.
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-07-20', recurrence: 'weekly', recurrenceDays: [1, 4] },
        '2026-07-21'
      )
    ).toBe('2026-07-23');
  });

  it('respects the interval for a multi-day weekly event (every other week)', () => {
    // Base week of Mon 20 Jul, [Mon, Thu], every 2 weeks. The off week (27 Jul –
    // 2 Aug) is skipped, so after Thu 23 Jul the next is Mon 3 Aug.
    expect(
      nextOccurrenceOnOrAfter(
        { date: '2026-07-20', recurrence: 'weekly', recurrenceInterval: 2, recurrenceDays: [1, 4] },
        '2026-07-24'
      )
    ).toBe('2026-08-03');
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
