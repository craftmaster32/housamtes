// HouseMates — bill-due-reminder Edge Function
// Runs daily at 08:00 via Supabase cron (set up in dashboard).
// Finds unsettled bills due in 1–7 days, then for each house member
// checks their personal preference (notify_bill_due + bill_due_days_before)
// and only sends to those whose reminder day matches.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { billDueCopy, normalizeLang } from '../_shared/notificationCopy.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (_req: Request) => {
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

  for (const bill of bills) {
    // How many days until this bill is due?
    const daysUntilDue = checkDays.find((d) => dateInDays(d) === bill.date);
    if (daysUntilDue === undefined) continue;

    // Fetch push tokens and preferences for this house in one query
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token, user_id, language')
      .eq('house_id', bill.house_id);

    if (!tokenRows || tokenRows.length === 0) continue;

    const userIds = tokenRows.map((r: { user_id: string }) => r.user_id);

    const { data: prefRows } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_bill_due, bill_due_days_before')
      .eq('house_id', bill.house_id)
      .in('user_id', userIds);

    const prefMap = new Map<string, { notify_bill_due: boolean; bill_due_days_before: number }>();
    for (const row of prefRows ?? []) {
      prefMap.set(row.user_id, row);
    }

    // Only send to users whose preference matches today's reminder window
    const eligible = tokenRows
      .filter((r: { user_id: string }) => {
        const prefs = prefMap.get(r.user_id);
        if (!prefs) {
          // No preference row → use defaults: notify_bill_due = true, days_before = 2
          return daysUntilDue === 2;
        }
        return prefs.notify_bill_due !== false && prefs.bill_due_days_before === daysUntilDue;
      })
      .map((r: { token: string; language?: string }) => ({
        token: r.token,
        language: normalizeLang(r.language),
      }))
      .filter((r: { token: string }) => Boolean(r.token));

    if (eligible.length === 0) continue;

    const currency = houseCurrency.get(bill.house_id) ?? '₪';
    const messages = eligible.map(({ token, language }) => {
      const copy = billDueCopy(language, {
        title: bill.title,
        amount: Number(bill.amount).toFixed(2),
        currency,
        daysUntil: daysUntilDue,
      });
      return {
        to: token,
        title: copy.title,
        body: copy.body,
        sound: 'default',
        data: { screen: 'bills' },
      };
    });

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    totalSent += eligible.length;
  }

  return new Response(JSON.stringify({ sent: totalSent, bills: bills.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
