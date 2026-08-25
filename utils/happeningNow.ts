import { nextOccurrenceOnOrAfter, type RecurringEventInput } from '@utils/events';

// Any event-like row the dashboard can surface: it must carry recurrence fields
// (for the occurrence maths) and may carry a start time (for same-day ordering).
export interface UpcomingInput extends RecurringEventInput {
  startTime?: string;
}

/**
 * Resolve each event to its next occurrence on or after `today` (expanding
 * weekly/monthly/yearly repeats, so a recurring event whose base date is in the
 * past still surfaces), then return the soonest `limit`, sorted by date and then
 * start time. Each returned item carries its resolved occurrence `date`, so the
 * caller renders the upcoming hit rather than the original base date.
 */
export function upcomingEventOccurrences<T extends UpcomingInput>(
  events: T[],
  today: string,
  limit: number
): (T & { date: string })[] {
  const resolved: (T & { date: string })[] = [];
  for (const e of events) {
    const occ = nextOccurrenceOnOrAfter(e, today);
    if (occ) resolved.push({ ...e, date: occ });
  }
  resolved.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.startTime ?? '').localeCompare(b.startTime ?? '');
  });
  return resolved.slice(0, limit);
}
