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

// Does the (possibly recurring) event fall on targetYMD?
function occursOn(event: EventRow, targetYMD: string): boolean {
  if (targetYMD < event.date) return false;
  if (event.recurrence_end && targetYMD > event.recurrence_end) return false;
  if (!event.recurrence) return event.date === targetYMD;

  const step = normalizeInterval(event.recurrence_interval);
  const target = new Date(`${targetYMD}T00:00:00`);
  let cur = new Date(`${event.date}T00:00:00`);
  let guard = 0;
  while (cur <= target && guard++ < 10000) {
    if (toYMD(cur) === targetYMD) return true;
    if (event.recurrence === 'daily') cur = addDays(cur, step);
    else if (event.recurrence === 'weekly') cur = addDays(cur, 7 * step);
    else if (event.recurrence === 'monthly') cur = addMonthsClamped(cur, step);
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
      'id, title, date, start_time, house_id, recurrence, recurrence_interval, recurrence_end'
    );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No events' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Cache per-house recipients so we fetch tokens + prefs once per house.
  interface Recipient {
    token: string;
    language: string;
    notify: boolean;
    daysBefore: number;
  }
  const houseRecipients = new Map<string, Recipient[]>();

  async function recipientsFor(houseId: string): Promise<Recipient[]> {
    const cached = houseRecipients.get(houseId);
    if (cached) return cached;

    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token, user_id, language')
      .eq('house_id', houseId);

    if (!tokenRows || tokenRows.length === 0) {
      houseRecipients.set(houseId, []);
      return [];
    }

    const userIds = tokenRows.map((r: { user_id: string }) => r.user_id);
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

    const recipients: Recipient[] = tokenRows
      .filter((r: { token: string }) => Boolean(r.token))
      .map((r: { token: string; user_id: string; language?: string }) => {
        const prefs = prefMap.get(r.user_id);
        return {
          token: r.token,
          language: normalizeLang(r.language),
          // No pref row → app defaults (reminder on, 1 day before).
          notify: prefs ? prefs.notify_event_reminder !== false : true,
          daysBefore: prefs ? prefs.event_reminder_days_before : 1,
        };
      });

    houseRecipients.set(houseId, recipients);
    return recipients;
  }

  let totalSent = 0;

  for (const event of events as EventRow[]) {
    for (const lead of LEAD_DAYS) {
      if (!occursOn(event, targetFor.get(lead)!)) continue;

      const recipients = await recipientsFor(event.house_id);
      const eligible = recipients.filter((r) => r.notify && r.daysBefore === lead);
      if (eligible.length === 0) continue;

      const messages = eligible.map((r) => {
        const copy = eventReminderCopy(r.language as 'en' | 'es' | 'he', {
          title: event.title,
          startTime: event.start_time ?? undefined,
          daysUntil: lead,
        });
        return {
          to: r.token,
          title: copy.title,
          body: copy.body,
          sound: 'default',
          data: { screen: 'calendar' },
        };
      });

      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      totalSent += eligible.length;
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, events: events.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
