import type { Chore } from '@stores/choresStore';

/** Weekday keys stored on weekly chores (Sunday first). */
export const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

/** "1" → "1st", "22" → "22nd". */
export function ordinal(n: string): string {
  const num = parseInt(n, 10);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** A stored weekday key ("Thu") as a full weekday name in the given language. */
export function localizedWeekDay(englishDay: string, language: string): string {
  const idx = WEEK_DAYS.indexOf(englishDay);
  if (idx < 0) return englishDay;
  return new Intl.DateTimeFormat(language, { weekday: 'long' }).format(new Date(2024, 0, 7 + idx));
}

/** How often a chore repeats ("Every Thursday", "1st of month"), or null for one-offs. */
export function freqLabel(
  chore: Chore,
  t: (key: string, opts?: Record<string, unknown>) => string,
  language: string
): string | null {
  if (chore.recurrence === 'once') return null;
  if (chore.recurrence === 'weekly')
    return chore.recurrenceDay
      ? `Every ${localizedWeekDay(chore.recurrenceDay, language)}`
      : t('chores.weekly');
  if (chore.recurrence === 'monthly')
    return chore.recurrenceDay
      ? `${ordinal(chore.recurrenceDay)} ${t('chores.of_month')}`
      : t('chores.monthly');
  return null;
}
