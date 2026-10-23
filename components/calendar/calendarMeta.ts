import type { IoniconName } from '@/types/icons';
import type { EventRecurrence } from '@stores/eventsStore';
import type { ColorTokens } from '@constants/colors';
import { normalizeInterval } from '@utils/events';

/** One thing on a calendar day: a house event, parking, a bill, a task or a personal event. */
export interface CalendarEvent {
  id: string;
  sourceId: string;
  date: string;
  endDate?: string;
  title: string;
  type: CalendarEventType;
  detail?: string;
  createdBy?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  recurrence?: EventRecurrence;
  recurrenceInterval?: number;
  recurrenceDays?: number[];
  person?: string;
}

export type CalendarEventType =
  | 'event'
  | 'parking'
  | 'parking-pending'
  | 'bill'
  | 'chore'
  | 'personal';

export const EVENT_TYPES: CalendarEventType[] = [
  'event',
  'parking',
  'parking-pending',
  'bill',
  'chore',
  'personal',
];

export const TYPE_ICON: Record<CalendarEventType, IoniconName> = {
  event: 'calendar-outline',
  parking: 'car-outline',
  'parking-pending': 'car-outline',
  bill: 'cash-outline',
  chore: 'sparkles-outline',
  personal: 'person-outline',
};

/** Each kind of entry has its own ink, taken from the app palette. */
export function typeColor(type: CalendarEventType, c: ColorTokens): string {
  switch (type) {
    case 'event':
      return c.primary;
    case 'parking':
      return c.warning;
    case 'parking-pending':
      return c.textTertiary;
    case 'bill':
      return c.negative;
    case 'chore':
      return c.positive;
    case 'personal':
      return '#8B6BB8';
  }
}

export const typeLabelKey = (type: CalendarEventType): string =>
  `calendar.legend_${type.replace('-', '_')}`;

export const WEEKDAY_KEYS = [
  'weekday_su',
  'weekday_mo',
  'weekday_tu',
  'weekday_we',
  'weekday_th',
  'weekday_fr',
  'weekday_sa',
] as const;

export const MONTH_KEYS = [
  'month_january',
  'month_february',
  'month_march',
  'month_april',
  'month_may',
  'month_june',
  'month_july',
  'month_august',
  'month_september',
  'month_october',
  'month_november',
  'month_december',
] as const;

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatShortDate(ymd: string, lang: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd;
  const locale = lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
  return new Date(ymd + 'T12:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

// 'daily' → 'day', etc. — the singular noun used when composing repeat labels.
export const UNIT_NOUN: Record<EventRecurrence, 'day' | 'week' | 'month' | 'year'> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

type Translate = (key: string, opts?: Record<string, unknown>) => string;

// A friendly label for a cadence: "Weekly" when interval is 1, otherwise
// "Every N weeks".
export function recurrenceLabel(
  t: Translate,
  recurrence: EventRecurrence,
  interval: number
): string {
  const step = normalizeInterval(interval);
  if (step === 1) return t(`calendar.repeat_${recurrence}`);
  const noun = UNIT_NOUN[recurrence];
  return t('calendar.repeat_every_n', {
    count: step,
    unit: t(`calendar.repeat_unit_${noun}s`),
  });
}
