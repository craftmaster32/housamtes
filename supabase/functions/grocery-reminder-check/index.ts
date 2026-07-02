// HouseMates — grocery-reminder-check Edge Function
// Runs on a schedule (recommended: every 5 minutes) via Supabase Cron.
// Finds personal grocery reminders whose time has arrived, pushes a
// notification to the person who set them, then marks them sent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (_req: Request) => {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();

  const { data: reminders, error } = await supabase
    .from('grocery_reminders')
    .select('id, house_id, user_id, label')
    .eq('sent', false)
    .lte('remind_at', nowIso);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reminders: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let totalSent = 0;
  const dueIds: string[] = [];

  for (const reminder of reminders as Array<{
    id: string;
    house_id: string;
    user_id: string;
    label: string;
  }>) {
    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', reminder.user_id)
      .eq('house_id', reminder.house_id);

    const tokens = ((tokenRows ?? []) as Array<{ token: string }>)
      .map((r) => r.token)
      .filter(Boolean);

    if (tokens.length > 0) {
      const messages = tokens.map((to: string) => ({
        to,
        title: '🛒 Grocery reminder',
        body: reminder.label,
        sound: 'default',
        data: { screen: 'grocery' },
      }));

      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      totalSent += tokens.length;
    }

    // Mark as sent even with no registered device, so it never re-fires.
    dueIds.push(reminder.id);
  }

  if (dueIds.length > 0) {
    await supabase.from('grocery_reminders').update({ sent: true }).in('id', dueIds);
  }

  return new Response(JSON.stringify({ sent: totalSent, reminders: reminders.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
