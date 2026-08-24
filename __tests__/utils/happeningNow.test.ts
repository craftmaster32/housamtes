import { upcomingEventOccurrences, type UpcomingInput } from '@utils/happeningNow';

interface TestEvent extends UpcomingInput {
  id: string;
  title: string;
}

const ev = (id: string, date: string, extra: Partial<TestEvent> = {}): TestEvent => ({
  id,
  title: id,
  date,
  ...extra,
});

describe('upcomingEventOccurrences', () => {
  const today = '2026-08-24';

  it('drops events whose (only) date is in the past', () => {
    const result = upcomingEventOccurrences([ev('past', '2026-08-01')], today, 3);
    expect(result).toHaveLength(0);
  });

  it('keeps an event landing exactly today', () => {
    const result = upcomingEventOccurrences([ev('today', today)], today, 3);
    expect(result.map((e) => e.id)).toEqual(['today']);
  });

  it('sorts by date then start time', () => {
    const result = upcomingEventOccurrences(
      [
        ev('later', '2026-08-26'),
        ev('soonEvening', '2026-08-25', { startTime: '20:00' }),
        ev('soonMorning', '2026-08-25', { startTime: '08:00' }),
      ],
      today,
      5
    );
    expect(result.map((e) => e.id)).toEqual(['soonMorning', 'soonEvening', 'later']);
  });

  it('caps the result at the requested limit', () => {
    const events = [
      ev('a', '2026-08-25'),
      ev('b', '2026-08-26'),
      ev('c', '2026-08-27'),
      ev('d', '2026-08-28'),
    ];
    expect(upcomingEventOccurrences(events, today, 3)).toHaveLength(3);
  });

  it('surfaces a recurring event on its next occurrence, not its past base date', () => {
    // A weekly event whose base date is well before today should resolve to the
    // upcoming occurrence and carry that resolved date.
    const weekly = ev('weekly', '2026-08-04', { recurrence: 'weekly' });
    const [occ] = upcomingEventOccurrences([weekly], today, 3);
    expect(occ.id).toBe('weekly');
    expect(occ.date >= today).toBe(true);
    expect(occ.date).toBe('2026-08-25'); // next weekly hit on/after 24 Aug
  });
});
