import type { TaskRecurrence } from '@stores/tasksStore';

/** Weekday keys stored on weekly tasks (Sunday first) — same values the reminder reads. */
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

/** The repeat day a new task starts with: today's weekday, or today's date. */
export function defaultRepeatDay(recurrence: TaskRecurrence, today = new Date()): string | null {
  if (recurrence === 'weekly') return WEEK_DAYS[today.getDay()];
  if (recurrence === 'monthly') return String(today.getDate());
  return null;
}

/**
 * How often a task repeats ("Every Thursday", "1st of month"), or null for
 * one-off tasks. Wording as on the old Chores page.
 */
export function repeatLabel(
  task: { recurrence: TaskRecurrence; recurrenceDay: string | null },
  t: (key: string, opts?: Record<string, unknown>) => string,
  language: string
): string | null {
  if (task.recurrence === 'weekly')
    return task.recurrenceDay
      ? t('tasks.every_day', { day: localizedWeekDay(task.recurrenceDay, language) })
      : t('tasks.weekly');
  if (task.recurrence === 'monthly')
    return task.recurrenceDay
      ? `${ordinal(task.recurrenceDay)} ${t('tasks.of_month')}`
      : t('tasks.monthly');
  return null;
}
