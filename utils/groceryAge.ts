// How long a grocery item has been waiting on the list.
//
// Items that sit on the list for STALE_AFTER_HOURS or more get a gentle nudge:
// an amber "age" label in the list, and a push from the grocery-reminder-check
// Edge Function (which uses the same threshold — keep the two in sync).

export const STALE_AFTER_HOURS = 72;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type ItemAge =
  | { unit: 'now' }
  | { unit: 'minutes'; count: number }
  | { unit: 'hours'; count: number }
  | { unit: 'days'; count: number };

/** Whole-unit age of an item, rounded down. Future / invalid dates count as "now". */
export function getItemAge(createdAt: string, now: number = Date.now()): ItemAge {
  const ms = now - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < MINUTE_MS) return { unit: 'now' };
  if (ms < HOUR_MS) return { unit: 'minutes', count: Math.floor(ms / MINUTE_MS) };
  if (ms < DAY_MS) return { unit: 'hours', count: Math.floor(ms / HOUR_MS) };
  return { unit: 'days', count: Math.floor(ms / DAY_MS) };
}

/** True once an item has been waiting STALE_AFTER_HOURS or longer. */
export function isItemStale(createdAt: string, now: number = Date.now()): boolean {
  const ms = now - new Date(createdAt).getTime();
  return Number.isFinite(ms) && ms >= STALE_AFTER_HOURS * HOUR_MS;
}

/** Compact, translated age label: "Just now", "5m ago", "3h ago", "2d ago". */
export function formatItemAge(
  createdAt: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  now: number = Date.now()
): string {
  const age = getItemAge(createdAt, now);
  if (age.unit === 'now') return t('grocery.age_now');
  if (age.unit === 'minutes') return t('grocery.age_minutes', { count: age.count });
  if (age.unit === 'hours') return t('grocery.age_hours', { count: age.count });
  return t('grocery.age_days', { count: age.count });
}
