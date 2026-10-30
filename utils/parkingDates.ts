import type { ParkingReservation } from '@stores/parkingStore';

/** "08:40" from an ISO timestamp, in the user's locale. */
export function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

/** Local YYYY-MM-DD for a Date. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's local YYYY-MM-DD. */
export function todayString(): string {
  return toDateString(new Date());
}

export interface DateParts {
  dayNum: string;
  monthAbbr: string;
  /** Month as written in a sentence, e.g. "Oct". */
  monthShort: string;
  weekdayFull: string;
  weekdayShort: string;
}

/** Day number, month and weekday names for a YYYY-MM-DD string. */
export function parseDateParts(dateStr: string, locale: string): DateParts {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    dayNum: String(d),
    monthAbbr: date.toLocaleString(locale, { month: 'short' }).toUpperCase(),
    monthShort: date.toLocaleString(locale, { month: 'short' }),
    weekdayFull: date.toLocaleString(locale, { weekday: 'long' }),
    weekdayShort: date.toLocaleString(locale, { weekday: 'short' }).toUpperCase(),
  };
}

/** Timed reservations first (earliest start), all-day ones last. */
export function byStartTime(a: ParkingReservation, b: ParkingReservation): number {
  if (!a.startTime && !b.startTime) return 0;
  if (!a.startTime) return 1;
  if (!b.startTime) return -1;
  return a.startTime.localeCompare(b.startTime);
}

/** "09:00 – 13:00", "09:00", or null when the reservation is all day. */
export function timeRange(r: Pick<ParkingReservation, 'startTime' | 'endTime'>): string | null {
  if (!r.startTime) return null;
  return `${r.startTime}${r.endTime ? ` – ${r.endTime}` : ''}`;
}
