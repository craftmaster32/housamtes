export interface ImminentEventInput {
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
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
