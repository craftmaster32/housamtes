import { format } from 'date-fns';

/**
 * Who was in the house on a given day.
 *
 * Used when an expense says "split between everyone" without naming people:
 * "everyone" means everyone who lived there ON THE DAY OF THE EXPENSE — not
 * whoever lives there today. So someone who joins later is never charged for
 * older expenses, and someone who left still pays their share of the time
 * they were there.
 */
export interface MemberSpan {
  id: string;
  /** ISO timestamp or YYYY-MM-DD; null = unknown (treated as "from the start"). */
  joinedAt: string | null;
  /** ISO timestamp or YYYY-MM-DD; null = still in the house. */
  leftAt: string | null;
}

/**
 * The calendar day of a join/leave time, in the phone's local time — the same
 * calendar bills and payments are dated in. (Stored times are UTC: joining at
 * 01:00 in Israel is still the previous day in UTC.) Plain dates stay as-is.
 */
const day = (ts: string): string => (ts.length <= 10 ? ts : format(new Date(ts), 'yyyy-MM-dd'));

/** Builds spans from current members (with join dates) and former members (with leave dates). */
export function toMemberSpans(
  current: { id: string; joinedAt: string | null }[],
  former: { id: string; leftAt: string | null }[] = []
): MemberSpan[] {
  const currentIds = new Set(current.map((m) => m.id));
  return [
    ...current.map((m) => ({ id: m.id, joinedAt: m.joinedAt ?? null, leftAt: null })),
    // Someone who left and later came back counts as their current membership.
    ...former
      .filter((f) => !currentIds.has(f.id))
      .map((f) => ({ id: f.id, joinedAt: null, leftAt: f.leftAt ?? null })),
  ];
}

/**
 * Ids of everyone in the house on `date` (YYYY-MM-DD): joined on or before
 * that day, and hadn't left before it.
 *
 * An expense dated before the house started in the app (e.g. rent logged for
 * the week before everyone signed up) counts as the house's first day — the
 * first day anyone joined.
 */
export function membersOn(members: MemberSpan[], date: string): string[] {
  const joinDays = members
    .map((m) => (m.joinedAt ? day(m.joinedAt) : null))
    .filter((d): d is string => d !== null)
    .sort();
  const firstDay = joinDays[0];
  const on = firstDay !== undefined && date < firstDay ? firstDay : date;
  return members
    .filter(
      (m) =>
        // A missing date (null or absent) means unknown: from the start / still here.
        (!m.joinedAt || day(m.joinedAt) <= on) && (!m.leftAt || day(m.leftAt) >= on)
    )
    .map((m) => m.id);
}

/** Old callers pass plain ids (= "always in the house"); new ones pass spans. */
export function asMemberSpans(members: (string | MemberSpan)[]): MemberSpan[] {
  return members.map((m) => (typeof m === 'string' ? { id: m, joinedAt: null, leftAt: null } : m));
}

/**
 * Who to tick by default for an expense on `date`: the people from `eligible`
 * (those shown in the form) who lived in the house that day. Falls back to
 * all of `eligible` so a form is never left with nobody ticked.
 */
export function defaultSplitOn(members: MemberSpan[], eligible: string[], date: string): string[] {
  const then = membersOn(members, date).filter((id) => eligible.includes(id));
  return then.length > 0 ? then : eligible;
}
