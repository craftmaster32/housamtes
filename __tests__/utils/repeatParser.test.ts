import { parseRepeatText } from '@utils/repeatParser';

describe('parseRepeatText', () => {
  // Fixed reference: Mon 20 Jul 2026 (a Monday), noon local time.
  const ref = new Date('2026-07-20T12:00:00');

  it('returns matched: false for empty or unrecognised input', () => {
    expect(parseRepeatText('', ref).matched).toBe(false);
    expect(parseRepeatText('   ', ref).matched).toBe(false);
    expect(parseRepeatText('lorem ipsum dolor', ref).matched).toBe(false);
  });

  it('parses "every Monday at 10 pm" into weekly + next Monday + 22:00', () => {
    const r = parseRepeatText('every Monday at 10 pm', ref);
    expect(r).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 1,
      date: '2026-07-20',
      startTime: '22:00',
      matched: true,
    });
  });

  it('parses "every Monday and Thursday at 10 pm" into a weekly day set', () => {
    const r = parseRepeatText('every Monday and Thursday at 10 pm', ref);
    expect(r.recurrence).toBe('weekly');
    expect(r.recurrenceInterval).toBe(1);
    expect(r.recurrenceDays).toEqual([1, 4]);
    expect(r.startTime).toBe('22:00');
    // Base date is the soonest of the two weekdays on/after the reference (Mon 20).
    expect(r.date).toBe('2026-07-20');
  });

  it('sorts and de-duplicates named weekdays and uses the soonest as the date', () => {
    // Fri (5) and Wed (3): from Mon 20 Jul, Wed 22 is sooner than Fri 24.
    const r = parseRepeatText('every friday and wednesday', ref);
    expect(r.recurrenceDays).toEqual([3, 5]);
    expect(r.date).toBe('2026-07-22');
  });

  it('does not set a day set for a single weekday', () => {
    expect(parseRepeatText('every monday', ref).recurrenceDays).toBeUndefined();
  });

  it('understands multi-day phrases in Hebrew', () => {
    // "every Sunday and Tuesday" → [0, 2].
    const r = parseRepeatText('כל יום ראשון ושלישי', ref);
    expect(r.recurrence).toBe('weekly');
    expect(r.recurrenceDays).toEqual([0, 2]);
  });

  it('resolves a weekday to its next occurrence after the reference day', () => {
    // Friday is 4 days after Mon 20 Jul → Fri 24 Jul.
    expect(parseRepeatText('friday 18:30', ref)).toMatchObject({
      date: '2026-07-24',
      startTime: '18:30',
    });
  });

  it('reads "every 2 weeks" as biweekly with no date or time', () => {
    const r = parseRepeatText('every 2 weeks', ref);
    expect(r.recurrence).toBe('weekly');
    expect(r.recurrenceInterval).toBe(2);
    expect(r.date).toBeUndefined();
    expect(r.startTime).toBeUndefined();
  });

  it('understands biweekly synonyms', () => {
    for (const phrase of ['biweekly', 'bi-weekly', 'fortnightly', 'every other week']) {
      const r = parseRepeatText(phrase, ref);
      expect(r.recurrence).toBe('weekly');
      expect(r.recurrenceInterval).toBe(2);
    }
  });

  it('parses the bare cadence keywords with interval 1', () => {
    expect(parseRepeatText('weekly', ref)).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 1,
    });
    expect(parseRepeatText('monthly', ref)).toMatchObject({
      recurrence: 'monthly',
      recurrenceInterval: 1,
    });
    expect(parseRepeatText('yearly', ref)).toMatchObject({
      recurrence: 'yearly',
      recurrenceInterval: 1,
    });
    expect(parseRepeatText('every day', ref)).toMatchObject({
      recurrence: 'daily',
      recurrenceInterval: 1,
    });
  });

  it('parses custom intervals for each unit', () => {
    expect(parseRepeatText('every 3 days', ref)).toMatchObject({
      recurrence: 'daily',
      recurrenceInterval: 3,
    });
    expect(parseRepeatText('every 3 months', ref)).toMatchObject({
      recurrence: 'monthly',
      recurrenceInterval: 3,
    });
    expect(parseRepeatText('every 2 years', ref)).toMatchObject({
      recurrence: 'yearly',
      recurrenceInterval: 2,
    });
  });

  it('parses a "from X to Y" time range into start and end', () => {
    expect(parseRepeatText('from 10 to 12', ref)).toMatchObject({
      startTime: '10:00',
      endTime: '12:00',
    });
    expect(parseRepeatText('every monday from 8 to 9 pm', ref)).toMatchObject({
      recurrence: 'weekly',
      startTime: '20:00',
      endTime: '21:00',
    });
    expect(parseRepeatText('10am-2pm', ref)).toMatchObject({
      startTime: '10:00',
      endTime: '14:00',
    });
  });

  it('parses two times joined with "and" into start and end', () => {
    expect(parseRepeatText('every monday at 10 and 12', ref)).toMatchObject({
      recurrence: 'weekly',
      startTime: '10:00',
      endTime: '12:00',
    });
    expect(parseRepeatText('at 9 am and 5 pm', ref)).toMatchObject({
      startTime: '09:00',
      endTime: '17:00',
    });
  });

  it('does not treat weekday "and" or interval numbers as a time range', () => {
    // "Monday and Thursday" must not become a time range.
    const days = parseRepeatText('every monday and thursday', ref);
    expect(days.startTime).toBeUndefined();
    expect(days.endTime).toBeUndefined();
    // "every 2 weeks" — the 2 is an interval, not a time.
    const iv = parseRepeatText('every 2 weeks', ref);
    expect(iv.startTime).toBeUndefined();
    expect(iv.endTime).toBeUndefined();
  });

  it('reads "every other Monday" as biweekly on that day', () => {
    const r = parseRepeatText('every other monday', ref);
    expect(r.recurrence).toBe('weekly');
    expect(r.recurrenceInterval).toBe(2);
    expect(r.recurrenceDays).toBeUndefined();
    expect(r.date).toBe('2026-07-20');
  });

  it('reads a spelled-out Hebrew interval', () => {
    // "every three weeks" in Hebrew.
    expect(parseRepeatText('כל שלושה שבועות', ref)).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 3,
    });
  });

  it('shares the meridiem across a range even when a side has minutes', () => {
    expect(parseRepeatText('8:30 to 9 pm', ref)).toMatchObject({
      startTime: '20:30',
      endTime: '21:00',
    });
    expect(parseRepeatText('8 pm to 9:30', ref)).toMatchObject({
      startTime: '20:00',
      endTime: '21:30',
    });
  });

  it('parses a time on its own (no cadence)', () => {
    const r = parseRepeatText('22:00', ref);
    expect(r.startTime).toBe('22:00');
    expect(r.recurrence).toBeUndefined();
    expect(r.matched).toBe(true);
  });

  it('handles 12-hour edge cases', () => {
    expect(parseRepeatText('12 am', ref).startTime).toBe('00:00');
    expect(parseRepeatText('12 pm', ref).startTime).toBe('12:00');
    expect(parseRepeatText('at 8', ref).startTime).toBe('08:00');
    expect(parseRepeatText('10:30pm', ref).startTime).toBe('22:30');
  });

  it('does not mistake the "2" in "every 2 weeks" for a time', () => {
    expect(parseRepeatText('every 2 weeks', ref).startTime).toBeUndefined();
  });

  it('understands Spanish phrases', () => {
    expect(parseRepeatText('cada lunes a las 22:00', ref)).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 1,
      date: '2026-07-20',
      startTime: '22:00',
    });
    expect(parseRepeatText('cada 2 semanas', ref)).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 2,
    });
    expect(parseRepeatText('mensual', ref).recurrence).toBe('monthly');
  });

  it('understands Hebrew phrases', () => {
    // "every Monday" — weekday name contains "יום" (day) but must stay weekly.
    expect(parseRepeatText('כל יום שני', ref)).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 1,
      date: '2026-07-20',
    });
    // "every two weeks"
    expect(parseRepeatText('כל שבועיים', ref)).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 2,
    });
    // "daily"
    expect(parseRepeatText('כל יום', ref).recurrence).toBe('daily');
  });

  it('understands the Hebrew dual forms (every two days/weeks/months/years)', () => {
    expect(parseRepeatText('כל יומיים', ref)).toMatchObject({
      recurrence: 'daily',
      recurrenceInterval: 2,
    });
    expect(parseRepeatText('כל שבועיים', ref)).toMatchObject({
      recurrence: 'weekly',
      recurrenceInterval: 2,
    });
    expect(parseRepeatText('כל חודשיים', ref)).toMatchObject({
      recurrence: 'monthly',
      recurrenceInterval: 2,
    });
    expect(parseRepeatText('כל שנתיים', ref)).toMatchObject({
      recurrence: 'yearly',
      recurrenceInterval: 2,
    });
  });

  it('defaults the reference to now when omitted', () => {
    // Just assert it runs and produces a well-formed date for a weekday phrase.
    const r = parseRepeatText('every friday');
    expect(r.recurrence).toBe('weekly');
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
