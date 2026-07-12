// HouseMates — chore-due-reminder Edge Function
// Schedule: daily at 09:00 via Supabase cron (set up in dashboard).
//
// Phase 6: "Chore due today → assigned person". Finds unfinished recurring
// chores whose recurrence day matches today in the house's own timezone
// (weekly: 'Sun'…'Sat', monthly: '1'…'31' — same values the app writes) and
// pushes a reminder to the person the chore is assigned to, respecting their
// notify_chore_overdue preference (the app's single "chore notifications"
// toggle). Unassigned chores are skipped — there is nobody to remind.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Today's short weekday name and day-of-month in the given IANA timezone.
function getLocalToday(tz: string): { weekday: string; dayOfMonth: string } {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  // en-CA short weekday names match the app's WEEK_DAYS values ('Sun'…'Sat').
  const weekday = WEEK_DAYS.includes(parts['weekday'] ?? '') ? (parts['weekday'] as string) : '';
  const dayOfMonth = String(parseInt(parts['day'] ?? '0', 10));
  return { weekday, dayOfMonth };
}

interface ChoreRow {
  id: string;
  title: string;
  house_id: string;
  assigned_to: string | null;
  recurrence: string | null;
  recurrence_day: string | null;
}

Deno.serve(async (_req: Request) => {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Unfinished recurring chores that are assigned to someone.
  const { data: chores, error } = await supabase
    .from('chores')
    .select('id, title, house_id, assigned_to, recurrence, recurrence_day')
    .eq('is_done', false)
    .in('recurrence', ['weekly', 'monthly'])
    .not('assigned_to', 'is', null)
    .not('recurrence_day', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!chores || chores.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No assigned recurring chores' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Per-house timezone so "today" means the housemates' today, not UTC's.
  const houseIds = [...new Set((chores as ChoreRow[]).map((c) => c.house_id))];
  const houseTz = new Map<string, string>();
  const { data: houseRows } = await supabase
    .from('houses')
    .select('id, timezone')
    .in('id', houseIds);
  for (const h of (houseRows ?? []) as Array<{ id: string; timezone?: string }>) {
    houseTz.set(h.id, h.timezone ?? 'UTC');
  }

  // Which chores are due today in their house's local calendar?
  const dueChores = (chores as ChoreRow[]).filter((c) => {
    const { weekday, dayOfMonth } = getLocalToday(houseTz.get(c.house_id) ?? 'UTC');
    if (c.recurrence === 'weekly') return c.recurrence_day === weekday;
    if (c.recurrence === 'monthly')
      return String(parseInt(c.recurrence_day ?? '', 10)) === dayOfMonth;
    return false;
  });

  if (dueChores.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No chores due today' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let totalSent = 0;

  for (const houseId of houseIds) {
    const houseChores = dueChores.filter((c) => c.house_id === houseId);
    if (houseChores.length === 0) continue;

    const assigneeIds = [...new Set(houseChores.map((c) => c.assigned_to as string))];

    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .eq('house_id', houseId)
      .in('user_id', assigneeIds);
    if (!tokenRows || tokenRows.length === 0) continue;

    const { data: prefRows } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_chore_overdue')
      .eq('house_id', houseId)
      .in('user_id', assigneeIds);
    const optedOut = new Set(
      ((prefRows ?? []) as Array<{ user_id: string; notify_chore_overdue: boolean | null }>)
        .filter((p) => p.notify_chore_overdue === false)
        .map((p) => p.user_id)
    );

    const messages: Array<Record<string, unknown>> = [];
    for (const chore of houseChores) {
      const assignee = chore.assigned_to as string;
      if (optedOut.has(assignee)) continue;
      const tokens = tokenRows
        .filter((r: { user_id: string }) => r.user_id === assignee)
        .map((r: { token: string }) => r.token)
        .filter(Boolean) as string[];
      for (const to of tokens) {
        messages.push({
          to,
          title: '🧹 Chore due today',
          body: `"${chore.title}" is due today — it's on your list.`,
          sound: 'default',
          data: { screen: 'chores' },
        });
      }
    }

    if (messages.length === 0) continue;

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    totalSent += messages.length;
  }

  return new Response(JSON.stringify({ sent: totalSent, due: dueChores.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
