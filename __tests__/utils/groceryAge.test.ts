import { formatItemAge, getItemAge, isItemStale, STALE_AFTER_HOURS } from '@utils/groceryAge';

const NOW = new Date('2026-10-11T12:00:00Z').getTime();
const ago = (ms: number): string => new Date(NOW - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Echoes the key + count so we can assert which label was picked.
const t = (key: string, opts?: Record<string, unknown>): string =>
  opts?.count !== undefined ? `${key}:${String(opts.count)}` : key;

describe('getItemAge', () => {
  it('rounds down to the biggest whole unit', () => {
    expect(getItemAge(ago(30 * 1000), NOW)).toEqual({ unit: 'now' });
    expect(getItemAge(ago(5 * MIN), NOW)).toEqual({ unit: 'minutes', count: 5 });
    expect(getItemAge(ago(3 * HOUR + 59 * MIN), NOW)).toEqual({ unit: 'hours', count: 3 });
    expect(getItemAge(ago(2 * DAY + 23 * HOUR), NOW)).toEqual({ unit: 'days', count: 2 });
  });

  it('treats future or broken dates as "just now" instead of crashing', () => {
    expect(getItemAge(new Date(NOW + HOUR).toISOString(), NOW)).toEqual({ unit: 'now' });
    expect(getItemAge('not a date', NOW)).toEqual({ unit: 'now' });
  });
});

describe('isItemStale', () => {
  it('flips exactly at the 72-hour mark', () => {
    expect(STALE_AFTER_HOURS).toBe(72);
    expect(isItemStale(ago(72 * HOUR - MIN), NOW)).toBe(false);
    expect(isItemStale(ago(72 * HOUR), NOW)).toBe(true);
    expect(isItemStale(ago(10 * DAY), NOW)).toBe(true);
  });

  it('never flags a broken date as stale', () => {
    expect(isItemStale('not a date', NOW)).toBe(false);
  });
});

describe('formatItemAge', () => {
  it('picks the compact translated label for each range', () => {
    expect(formatItemAge(ago(10 * 1000), t, NOW)).toBe('grocery.age_now');
    expect(formatItemAge(ago(12 * MIN), t, NOW)).toBe('grocery.age_minutes:12');
    expect(formatItemAge(ago(5 * HOUR), t, NOW)).toBe('grocery.age_hours:5');
    expect(formatItemAge(ago(4 * DAY), t, NOW)).toBe('grocery.age_days:4');
  });
});
