// Nestiq — bill-due-reminder Edge Function
// Runs daily at 08:00 via Supabase cron (set up in dashboard).
// Finds unsettled bills due in 1–7 days, then for each house member
// checks their personal preference (notify_bill_due + bill_due_days_before)
// and only sends to those whose reminder day matches.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  if (authHeader && authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

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

  let totalSent = 0;

  for (const bill of bills) {
    // How many days until this bill is due?
    const daysUntilDue = checkDays.find((d) => dateInDays(d) === bill.date);
    if (daysUntilDue === undefined) continue;

    // Fetch push tokens and preferences for this house in one query
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token, user_id')
      .eq('house_id', bill.house_id);

    if (!tokenRows || tokenRows.length === 0) continue;

    const userIds = tokenRows.map((r: { user_id: string }) => r.user_id);

    const { data: prefRows } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_bill_due, bill_due_days_before')
      .eq('house_id', bill.house_id)
      .in('user_id', userIds);

    const prefMap = new Map<string, { notify_bill_due: boolean; bill_due_days_before: number }>();
    for (const row of (prefRows ?? [])) {
      prefMap.set(row.user_id, row);
    }

    // Only send to users whose preference matches today's reminder window
    const eligibleTokens = tokenRows
      .filter((r: { user_id: string }) => {
        const prefs = prefMap.get(r.user_id);
        if (!prefs) {
          // No preference row → use defaults: notify_bill_due = true, days_before = 2
          return daysUntilDue === 2;
        }
        return prefs.notify_bill_due !== false && prefs.bill_due_days_before === daysUntilDue;
      })
      .map((r: { token: string }) => r.token)
      .filter(Boolean) as string[];

    if (eligibleTokens.length === 0) continue;

    const messages = eligibleTokens.map((to: string) => ({
      to,
      title: `⏰ Bill due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
      body: `${bill.title} — ₪${Number(bill.amount).toFixed(2)} due on ${bill.date}`,
      sound: 'default',
      data: { screen: 'bills' },
    }));

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    totalSent += eligibleTokens.length;
  }

  return new Response(JSON.stringify({ sent: totalSent, bills: bills.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
