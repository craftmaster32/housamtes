// HouseMates — grocery-reminder-check Edge Function
// Runs on a schedule (recommended: every 5 minutes) via Supabase Cron.
// Finds personal grocery reminders whose time has arrived, pushes a
// notification to the person who set them, then marks them sent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TIMEOUT_MS = 5000;
const PUSH_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Sends with up to 3 attempts and exponential backoff (500ms, 1000ms), per
// this project's Edge Function notification rules (see AGENTS.md).
async function sendPushWithRetry(messages: unknown[]): Promise<boolean> {
  for (let attempt = 1; attempt <= PUSH_MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (resp.ok) return true;
    } catch {
      // fall through to retry
    }
    if (attempt < PUSH_MAX_ATTEMPTS) await sleep(2 ** (attempt - 1) * 500);
  }
  return false;
}

Deno.serve(async (_req: Request): Promise<Response> => {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();

  // Atomically claim due reminders in one statement — an UPDATE...RETURNING
  // means two overlapping runs can never both claim (and double-push) the
  // same row, unlike a separate select-then-mark-sent pair.
  const { data: reminders, error } = await supabase
    .from('grocery_reminders')
    .update({ sent: true })
    .eq('sent', false)
    .lte('remind_at', nowIso)
    .select('id, house_id, user_id, label');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!reminders || reminders.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reminders: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const typedReminders = reminders as Array<{
    id: string;
    house_id: string;
    user_id: string;
    label: string;
  }>;

  // Fetch every relevant push token in one query instead of one per reminder.
  const userIds = [...new Set(typedReminders.map((r) => r.user_id))];
  const { data: tokenRows, error: tokenError } = await supabase
    .from('push_tokens')
    .select('token, user_id, house_id')
    .in('user_id', userIds);

  if (tokenError) {
    // The reminders are already claimed (sent = true) — release the claim so
    // the next run retries them instead of silently dropping every push.
    await supabase
      .from('grocery_reminders')
      .update({ sent: false })
      .in(
        'id',
        typedReminders.map((r) => r.id)
      );
    return new Response(JSON.stringify({ error: tokenError.message }), { status: 500 });
  }

  const tokensByUser = new Map<string, string[]>();
  for (const row of (tokenRows ?? []) as Array<{
    token: string;
    user_id: string;
    house_id: string;
  }>) {
    const key = `${row.user_id}:${row.house_id}`;
    const list = tokensByUser.get(key) ?? [];
    list.push(row.token);
    tokensByUser.set(key, list);
  }

  let totalSent = 0;

  for (const reminder of typedReminders) {
    const tokens = (tokensByUser.get(`${reminder.user_id}:${reminder.house_id}`) ?? []).filter(
      Boolean
    );
    if (tokens.length === 0) continue;

    const messages = tokens.map((to: string) => ({
      to,
      title: '🛒 Grocery reminder',
      body: reminder.label,
      sound: 'default',
      data: { screen: 'grocery' },
    }));

    // Isolate each reminder's push attempt — a failure here must not stop
    // the rest of the batch, since every reminder is already marked sent.
    const delivered = await sendPushWithRetry(messages);
    if (delivered) {
      totalSent += tokens.length;
    } else {
      console.error('Expo push failed after retries', reminder.id);
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, reminders: typedReminders.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
