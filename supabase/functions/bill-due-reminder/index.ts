// HouseMates — bill-due-reminder Edge Function
// Runs daily at 08:00 via Supabase cron (set up in dashboard).
// Finds unsettled bills due in 1–7 days, then for each house member
// checks their personal preference (notify_bill_due + bill_due_days_before)
// and only sends to those whose reminder day matches.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { billDueCopy, normalizeLang } from '../_shared/notificationCopy.ts';
import { assertCronAuthorized } from '../_shared/cronAuth.ts';
import { sendWebPush, type WebPushSub } from '../_shared/webPush.ts';
import { dedupeUserIds } from '../_shared/webPushCore.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date();

  // Build a set of date strings for 1, 2, 3 and 7 days from today
  function dateInDays(n: number): string {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  const checkDays = [1, 2, 3, 7] as const;
  const datesToCheck = checkDays.map(dateInDays);

  // Find all unsettled bills due within our reminder window
  const { data: bills, error } = await supabase
    .from('bills')
    .select('id, title, amount, house_id, date')
    .in('date', datesToCheck)
    .eq('settled', false);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!bills || bills.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No bills due in reminder window' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Currency symbols per house — fetched once to avoid hardcoding ₪
  const houseCurrency = new Map<string, string>();
  const houseIds = [...new Set(bills.map((b: { house_id: string }) => b.house_id))];
  if (houseIds.length > 0) {
    const { data: houseRows } = await supabase
      .from('houses')
      .select('id, currency')
      .in('id', houseIds);
    for (const h of (houseRows ?? []) as Array<{ id: string; currency?: string }>) {
      houseCurrency.set(h.id, h.currency ?? '₪');
    }
  }

  let totalSent = 0;
  let totalWebSent = 0;
  const MAX_REMINDERS_PER_USER = 3;
  const remindersPerUser = new Map<string, number>();

  for (const bill of bills) {
    // How many days until this bill is due?
    const daysUntilDue = checkDays.find((d) => dateInDays(d) === bill.date);
    if (daysUntilDue === undefined) continue;

    // Fetch native tokens and web subscriptions for this house. Web subscribers
    // are gathered independently so a member who only uses the installed web app
    // (no native token) still gets the reminder.
    const [{ data: tokenRows }, { data: webRowsData }] = await Promise.all([
      supabase.from('push_tokens').select('token, user_id, language').eq('house_id', bill.house_id),
      supabase
        .from('web_push_subscriptions')
        .select('endpoint, p256dh, auth, user_id, language')
        .eq('house_id', bill.house_id),
    ]);

    const tokens = (tokenRows ?? []) as Array<{
      token: string;
      user_id: string;
      language?: string | null;
    }>;
    const webRows = (webRowsData ?? []) as WebPushSub[];
    if (tokens.length === 0 && webRows.length === 0) continue;

    const userIds = dedupeUserIds(tokens, webRows);

    const { data: prefRows } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_bill_due, bill_due_days_before')
      .eq('house_id', bill.house_id)
      .in('user_id', userIds);

    const prefMap = new Map<string, { notify_bill_due: boolean; bill_due_days_before: number }>();
    for (const row of prefRows ?? []) {
      prefMap.set(row.user_id, row);
    }

    // A user is due a reminder today when their preference window matches. No
    // preference row → defaults: notify_bill_due = true, days_before = 2.
    function isDue(userId: string): boolean {
      const prefs = prefMap.get(userId);
      if (!prefs) return daysUntilDue === 2;
      return prefs.notify_bill_due !== false && prefs.bill_due_days_before === daysUntilDue;
    }

    const dueTokens = tokens.filter((r) => isDue(r.user_id) && Boolean(r.token));
    const dueWebSubs = webRows.filter((r) => isDue(r.user_id));

    const allDueUserIds = dedupeUserIds(dueTokens, dueWebSubs);
    const cappedUserIds = new Set(
      allDueUserIds.filter((id) => (remindersPerUser.get(id) ?? 0) < MAX_REMINDERS_PER_USER)
    );
    for (const id of cappedUserIds) {
      remindersPerUser.set(id, (remindersPerUser.get(id) ?? 0) + 1);
    }

    const eligibleExpo = dueTokens
      .filter((r) => cappedUserIds.has(r.user_id))
      .map((r) => ({ token: r.token, language: normalizeLang(r.language) }));
    const eligibleWebSubs = dueWebSubs.filter((r) => cappedUserIds.has(r.user_id));

    if (eligibleExpo.length === 0 && eligibleWebSubs.length === 0) continue;

    const currency = houseCurrency.get(bill.house_id) ?? '₪';
    const copyFor = (language: string | null | undefined): { title: string; body: string } =>
      billDueCopy(normalizeLang(language), {
        title: bill.title,
        amount: Number(bill.amount).toFixed(2),
        currency,
        daysUntil: daysUntilDue,
      });

    if (eligibleExpo.length > 0) {
      const messages = eligibleExpo.map(({ token, language }) => {
        const copy = copyFor(language);
        return {
          to: token,
          title: copy.title,
          body: copy.body,
          sound: 'default',
          priority: 'high',
          data: { screen: 'bills' },
        };
      });

      try {
        await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(messages),
        });
        totalSent += eligibleExpo.length;
      } catch (err) {
        console.error(
          '[bill-due-reminder] Expo push failed:',
          err instanceof Error ? err.message : 'unknown'
        );
      }
    }

    if (eligibleWebSubs.length > 0) {
      totalWebSent += await sendWebPush(supabase, eligibleWebSubs, copyFor, { screen: 'bills' });
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, web: totalWebSent, bills: bills.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
