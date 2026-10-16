// HouseMates — grocery-reminder-check Edge Function
// Runs on a schedule (recommended: every 5 minutes) via Supabase Cron.
// Finds personal grocery reminders whose time has arrived, pushes a
// notification to the person who set them, then marks them sent.
// Also sends "Still on the list?" nudges for items waiting 72+ hours
// (see staleItems.ts).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { groceryReminderTitle, normalizeLang, type Lang } from '../_shared/notificationCopy.ts';
import { assertCronAuthorized } from '../_shared/cronAuth.ts';
import { runStaleItemCheck, type StaleCheckResult } from './staleItems.ts';
import { fetchPushDevices, sendPush, type PushDevice, type WebKeys } from '../_shared/push.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!serviceRoleKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment configuration' }), {
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Independent of personal reminders — a failure here never blocks them.
  let stale: StaleCheckResult = { sent: 0, items: 0 };
  try {
    stale = await runStaleItemCheck(supabase);
  } catch (err) {
    console.error('Stale grocery check failed', err instanceof Error ? err.message : err);
  }

  try {
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
      return new Response(JSON.stringify({ sent: 0, reminders: 0, stale }), {
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
    let tokenRows: PushDevice[] = [];
    let tokenError: string | null = null;
    try {
      tokenRows = await fetchPushDevices(supabase, { userIds });
    } catch (err) {
      tokenError = err instanceof Error ? err.message : 'Device lookup failed';
    }

    if (tokenError) {
      // The reminders are already claimed (sent = true) — release the claim so
      // the next run retries them instead of silently dropping every push.
      const { error: releaseError } = await supabase
        .from('grocery_reminders')
        .update({ sent: false })
        .in(
          'id',
          typedReminders.map((r) => r.id)
        );
      if (releaseError) {
        console.error(
          'Failed to release reminder claims after token lookup failure',
          releaseError.message
        );
      }
      return new Response(JSON.stringify({ error: tokenError }), { status: 500 });
    }

    const tokensByUser = new Map<string, Array<{ token: string; web?: WebKeys; language: Lang }>>();
    for (const row of tokenRows) {
      const key = `${row.user_id}:${row.house_id}`;
      const list = tokensByUser.get(key) ?? [];
      list.push({ token: row.token, web: row.web, language: normalizeLang(row.language) });
      tokensByUser.set(key, list);
    }

    let totalSent = 0;
    const failedReminderIds: string[] = [];

    for (const reminder of typedReminders) {
      const tokens = (tokensByUser.get(`${reminder.user_id}:${reminder.house_id}`) ?? []).filter(
        (r) => Boolean(r.token)
      );
      if (tokens.length === 0) continue;

      const messages = tokens.map(({ token, web, language }) => ({
        to: token,
        title: groceryReminderTitle(language),
        body: reminder.label,
        sound: 'default',
        data: { screen: 'grocery' },
        web,
      }));

      // Isolate each reminder's push attempt — a failure here must not stop
      // the rest of the batch.
      const delivered = await sendPush(supabase, messages);
      if (delivered) {
        totalSent += tokens.length;
      } else {
        console.error('Push failed after retries', reminder.id);
        failedReminderIds.push(reminder.id);
      }
    }

    // Release the claim on reminders whose push never went through, so the
    // next run retries them instead of the reminder silently going missing.
    if (failedReminderIds.length > 0) {
      const { error: releaseError } = await supabase
        .from('grocery_reminders')
        .update({ sent: false })
        .in('id', failedReminderIds);
      if (releaseError) {
        console.error('Failed to release reminder claims for retry', releaseError.message);
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, reminders: typedReminders.length, stale }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('grocery-reminder-check failed', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500 }
    );
  }
});
