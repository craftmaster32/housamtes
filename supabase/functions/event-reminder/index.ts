// HouseMates — event-reminder Edge Function
// Schedule: daily at 08:00 via Supabase cron (set up in dashboard).
//
// For every calendar event that lands on one of the reminder-lead dates
// (today, +1, +2, +3, +7), pushes a heads-up to each house member whose
// personal lead time (event_reminder_days_before) matches — respecting their
// notify_event_reminder toggle. Recurring events (weekly / monthly / yearly)
// are expanded so their next occurrence triggers a reminder too.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { eventReminderCopy, normalizeLang } from '../_shared/notificationCopy.ts';
import { assertCronAuthorized } from '../_shared/cronAuth.ts';
import { sendWebPush, type WebPushSub } from '../_shared/webPush.ts';
import { dedupeUserIds } from '../_shared/webPushCore.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const LEAD_DAYS = [0, 1, 2, 3, 7] as const;

interface EventRow {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  house_id: string;
  recurrence: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  recurrence_interval: number | null;
  recurrence_days: number[] | null;
  recurrence_end: string | null;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

// Advance whole months, clamping the day to the last day of the shorter month
// (matches date-fns addMonths, which the app uses when expanding recurrences).
function addMonthsClamped(d: Date, n: number): Date {
  const day = d.getDate();
  const nd = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
  nd.setDate(Math.min(day, lastDay));
  return nd;
}

// "every N units" — legacy rows have a null interval, meaning 1.
function normalizeInterval(interval: number | null): number {
  if (!interval || !Number.isFinite(interval)) return 1;
  return Math.max(1, Math.floor(interval));
}

// Midnight of the Sunday starting d's week — the anchor for weekly cadence.
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Does the (possibly recurring) event fall on targetYMD?
function occursOn(event: EventRow, targetYMD: string): boolean {
  if (targetYMD < event.date) return false;
  if (event.recurrence_end && targetYMD > event.recurrence_end) return false;
  if (!event.recurrence) return event.date === targetYMD;

  const step = normalizeInterval(event.recurrence_interval);
  const base = new Date(`${event.date}T00:00:00`);
  const target = new Date(`${targetYMD}T00:00:00`);

  // Weekly on a set of weekdays (e.g. every Mon & Thu).
  const days = (event.recurrence_days ?? []).filter((d) => d >= 0 && d <= 6);
  if (event.recurrence === 'weekly' && days.length > 0) {
    if (!days.includes(target.getDay())) return false;
    const weeks = Math.round(
      (startOfWeek(target).getTime() - startOfWeek(base).getTime()) / WEEK_MS
    );
    return weeks >= 0 && weeks % step === 0;
  }

  // Daily and weekly are pure arithmetic — no need to walk each occurrence.
  // Round the day difference so a DST transition can't shift it off a whole day.
  const dayDiff = Math.round((target.getTime() - base.getTime()) / 86400000);
  if (event.recurrence === 'daily') return dayDiff >= 0 && dayDiff % step === 0;
  if (event.recurrence === 'weekly') return dayDiff >= 0 && dayDiff % (7 * step) === 0;

  // Monthly / yearly clamp to shorter months, so step through them.
  let cur = base;
  let guard = 0;
  while (cur <= target && guard++ < 10000) {
    if (toYMD(cur) === targetYMD) return true;
    if (event.recurrence === 'monthly') cur = addMonthsClamped(cur, step);
    else cur = addMonthsClamped(cur, 12 * step);
  }
  return false;
}

Deno.serve(async (req: Request) => {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const targetFor = new Map<number, string>();
  for (const lead of LEAD_DAYS) targetFor.set(lead, toYMD(addDays(now, lead)));

  const { data: events, error } = await supabase
    .from('events')
    .select(
      'id, title, date, start_time, house_id, recurrence, recurrence_interval, recurrence_days, recurrence_end'
    );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No events' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cache per-house recipients so we fetch tokens + subs + prefs once per house.
  interface ExpoRecipient {
    token: string;
    language: string;
    notify: boolean;
    daysBefore: number;
  }
  interface WebRecipient {
    sub: WebPushSub;
    notify: boolean;
    daysBefore: number;
  }
  interface HouseRecipients {
    expo: ExpoRecipient[];
    web: WebRecipient[];
  }
  const houseRecipients = new Map<string, HouseRecipients>();

  async function recipientsFor(houseId: string): Promise<HouseRecipients> {
    const cached = houseRecipients.get(houseId);
    if (cached) return cached;

    const [{ data: tokenRows }, { data: allWebRows }] = await Promise.all([
      supabase.from('push_tokens').select('token, user_id, language').eq('house_id', houseId),
      // Web push subscribers must be gathered independently: a member who uses
      // the installed web app has a subscription but no native token, so keying
      // off push_tokens alone would silently exclude them (the original bug).
      supabase
        .from('web_push_subscriptions')
        .select('endpoint, p256dh, auth, user_id, language')
        .eq('house_id', houseId),
    ]);

    const tokens = (tokenRows ?? []) as Array<{
      token: string;
      user_id: string;
      language?: string | null;
    }>;
    const webRows = (allWebRows ?? []) as WebPushSub[];

    // Prefs for the union of native-token users and web-sub users.
    const userIds = dedupeUserIds(tokens, webRows);
    if (userIds.length === 0) {
      const empty = { expo: [], web: [] };
      houseRecipients.set(houseId, empty);
      return empty;
    }

    const { data: prefRows } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_event_reminder, event_reminder_days_before')
      .eq('house_id', houseId)
      .in('user_id', userIds);

    const prefMap = new Map<
      string,
      { notify_event_reminder: boolean; event_reminder_days_before: number }
    >();
    for (const row of prefRows ?? []) prefMap.set(row.user_id, row);

    // No pref row → app defaults (reminder on, 1 day before).
    function prefFor(userId: string): { notify: boolean; daysBefore: number } {
      const prefs = prefMap.get(userId);
      return {
        notify: prefs ? prefs.notify_event_reminder !== false : true,
        daysBefore: prefs ? prefs.event_reminder_days_before : 1,
      };
    }

    const expo: ExpoRecipient[] = tokens
      .filter((r) => Boolean(r.token))
      .map((r) => ({ token: r.token, language: normalizeLang(r.language), ...prefFor(r.user_id) }));

    const web: WebRecipient[] = webRows.map((sub) => ({ sub, ...prefFor(sub.user_id) }));

    const result = { expo, web };
    houseRecipients.set(houseId, result);
    return result;
  }

  let totalSent = 0;
  let totalWebSent = 0;

  for (const event of events as EventRow[]) {
    for (const lead of LEAD_DAYS) {
      if (!occursOn(event, targetFor.get(lead)!)) continue;

      const { expo, web } = await recipientsFor(event.house_id);
      const eligibleExpo = expo.filter((r) => r.notify && r.daysBefore === lead);
      const eligibleWeb = web.filter((r) => r.notify && r.daysBefore === lead);
      if (eligibleExpo.length === 0 && eligibleWeb.length === 0) continue;

      // Same copy for both channels, localized per recipient device language.
      const copyFor = (language: string | null | undefined): { title: string; body: string } =>
        eventReminderCopy(normalizeLang(language) as 'en' | 'es' | 'he', {
          title: event.title,
          startTime: event.start_time ?? undefined,
          daysUntil: lead,
        });

      if (eligibleExpo.length > 0) {
        const messages = eligibleExpo.map((r) => {
          const copy = copyFor(r.language);
          return {
            to: r.token,
            title: copy.title,
            body: copy.body,
            sound: 'default',
            priority: 'high',
            data: { screen: 'calendar' },
          };
        });

        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });

        totalSent += eligibleExpo.length;
      }

      if (eligibleWeb.length > 0) {
        totalWebSent += await sendWebPush(
          supabase,
          eligibleWeb.map((r) => r.sub),
          copyFor,
          { screen: 'calendar' }
        );
      }
    }
  }

  return new Response(
    JSON.stringify({ sent: totalSent, web: totalWebSent, events: events.length }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
});
