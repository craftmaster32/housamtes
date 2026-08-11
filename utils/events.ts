export type EventRecurrence = 'weekly' | 'monthly' | 'yearly';

export interface ImminentEventInput {
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
}

export interface RecurringEventInput {
  date: string; // YYYY-MM-DD — the first/base occurrence
  recurrence?: EventRecurrence;
  recurrenceEnd?: string; // YYYY-MM-DD — when the repeat stops
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
  const from = parseYMD(fromYMD);
  const end = event.recurrenceEnd ? parseYMD(event.recurrenceEnd) : null;
  let cur = parseYMD(event.date);
  let guard = 0;
  while (guard++ < 10000) {
    if (end && cur > end) return undefined;
    if (cur >= from) return ymd(cur);
    if (event.recurrence === 'weekly') cur = addDays(cur, 7);
    else if (event.recurrence === 'monthly') cur = addMonthsClamped(cur, 1);
    else cur = addMonthsClamped(cur, 12);
  }
  return undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;

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
