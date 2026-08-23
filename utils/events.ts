// The recurrence unit. The cadence is (interval × unit) — e.g. weekly with an
// interval of 2 is "every 2 weeks" (biweekly). Interval defaults to 1.
export type EventRecurrence = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ImminentEventInput {
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
}

export interface RecurringEventInput {
  date: string; // YYYY-MM-DD — the first/base occurrence
  recurrence?: EventRecurrence;
  recurrenceInterval?: number; // "every N units" — defaults to 1
  // For weekly recurrence only: the weekdays it lands on (0 = Sun … 6 = Sat),
  // e.g. [1, 4] = every Monday and Thursday. Empty/undefined → the base date's
  // own weekday, once per (interval) week.
  recurrenceDays?: number[];
  recurrenceEnd?: string; // YYYY-MM-DD — when the repeat stops
}

// Clamp a stored interval to a sane whole number (>= 1). Handles legacy rows
// where the column is null and any accidental fractional/zero values.
export function normalizeInterval(interval: number | undefined | null): number {
  if (!interval || !Number.isFinite(interval)) return 1;
  return Math.max(1, Math.floor(interval));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Sorted, de-duplicated, valid weekday numbers (0–6). Anything else is dropped.
export function normalizeWeekdays(days: number[] | undefined | null): number[] {
  if (!days || days.length === 0) return [];
  const seen = new Set<number>();
  for (const d of days) {
    if (Number.isInteger(d) && d >= 0 && d <= 6) seen.add(d);
  }
  return [...seen].sort((a, b) => a - b);
}

// Midnight of the Sunday that starts d's week — the anchor for weekly cadence.
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

// Whole weeks between two dates' week-starts (>= 0 when b is on/after a's week).
export function weeksBetween(base: Date, d: Date): number {
  return Math.round((startOfWeek(d).getTime() - startOfWeek(base).getTime()) / (7 * DAY_MS));
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function parseYMD(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

// Advance whole months, clamping the day to the last day of a shorter month
// (matches date-fns addMonths, used elsewhere to expand recurrences).
function addMonthsClamped(d: Date, n: number): Date {
  const day = d.getDate();
  const nd = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
  nd.setDate(Math.min(day, lastDay));
  return nd;
}

/**
 * The event's next occurrence date (YYYY-MM-DD) on or after `fromYMD`, taking
 * weekly/monthly/yearly recurrence — and its end date — into account. A
 * non-recurring event simply returns its own date when it hasn't passed.
 * Returns undefined when the event has no occurrence on or after that day.
 */
export function nextOccurrenceOnOrAfter(
  event: RecurringEventInput,
  fromYMD: string
): string | undefined {
  if (!event.recurrence) {
    return event.date >= fromYMD ? event.date : undefined;
  }
  const step = normalizeInterval(event.recurrenceInterval);
  const base = parseYMD(event.date);
  const from = parseYMD(fromYMD);
  const end = event.recurrenceEnd ? parseYMD(event.recurrenceEnd) : null;

  // Weekly on a set of weekdays (e.g. every Mon & Thu): scan day by day for the
  // next listed weekday that falls in an "on" week (week index divisible by step).
  const weekdays = event.recurrence === 'weekly' ? normalizeWeekdays(event.recurrenceDays) : [];
  if (weekdays.length > 0) {
    const daySet = new Set(weekdays);
    let cur = base > from ? base : from; // never before the base date
    let guard = 0;
    while (guard++ < 4000) {
      if (end && cur > end) return undefined;
      if (daySet.has(cur.getDay()) && weeksBetween(base, cur) % step === 0) return ymd(cur);
      cur = addDays(cur, 1);
    }
    return undefined;
  }

  let cur = base;
  let guard = 0;
  while (guard++ < 10000) {
    if (end && cur > end) return undefined;
    if (cur >= from) return ymd(cur);
    if (event.recurrence === 'daily') cur = addDays(cur, step);
    else if (event.recurrence === 'weekly') cur = addDays(cur, 7 * step);
    else if (event.recurrence === 'monthly') cur = addMonthsClamped(cur, step);
    else cur = addMonthsClamped(cur, 12 * step);
  }
  return undefined;
}

/**
 * Every occurrence date (YYYY-MM-DD) of a recurring event within [from, to],
 * honouring the interval, an optional weekly weekday set, and the recurrence end.
 * Used to paint the calendar grid; non-recurring events are handled by the caller.
 */
export function expandRecurrenceDates(event: RecurringEventInput, from: Date, to: Date): string[] {
  if (!event.recurrence) return [];
  const step = normalizeInterval(event.recurrenceInterval);
  const recEnd = event.recurrenceEnd ? parseYMD(event.recurrenceEnd) : null;
  const base = parseYMD(event.date);
  const dates: string[] = [];

  // Weekly on a set of weekdays (e.g. every Mon & Thu): scan the window day by
  // day, keeping listed weekdays that fall in an "on" week (step-aligned).
  const days = event.recurrence === 'weekly' ? normalizeWeekdays(event.recurrenceDays) : [];
  if (days.length > 0) {
    const daySet = new Set(days);
    let cur = base > from ? base : from; // never before the base date
    let guard = 0;
    while (cur <= to && guard++ < 4000) {
      if (recEnd && cur > recEnd) break;
      if (weeksBetween(base, cur) % step === 0 && daySet.has(cur.getDay())) dates.push(ymd(cur));
      cur = addDays(cur, 1);
    }
    return dates;
  }

  let current = base;
  const advance = (): void => {
    if (event.recurrence === 'daily') current = addDays(current, step);
    else if (event.recurrence === 'weekly') current = addDays(current, 7 * step);
    else if (event.recurrence === 'monthly') current = addMonthsClamped(current, step);
    else current = addMonthsClamped(current, 12 * step);
  };

  // Fast-forward to the first occurrence at or after `from`, guarded against a
  // stray zero/negative interval spinning forever.
  let guard = 0;
  while (current < from && guard++ < 10000) advance();
  while (current <= to && guard++ < 20000) {
    if (recEnd && current > recEnd) break;
    dates.push(ymd(current));
    advance();
  }
  return dates;
}

/**
 * An event is "imminent" when it lands on the current calendar day (so all-day
 * and later-today events still surface), or when it starts within the next 24
 * hours. Events whose start has already passed on a future date are never
 * imminent — only today's and the next-24h window qualify.
 */
export function isEventImminent(event: ImminentEventInput, now: Date = new Date()): boolean {
  const today = ymd(now);
  if (event.date === today) return true;

  const start = new Date(`${event.date}T${event.startTime ?? '00:00'}:00`);
  const diff = start.getTime() - now.getTime();
  return diff >= 0 && diff <= DAY_MS;
}
