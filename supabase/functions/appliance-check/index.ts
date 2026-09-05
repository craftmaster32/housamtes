// Housemates — appliance-check Edge Function
// Runs on a schedule (recommended: every 5 minutes) via Supabase Cron.
// Finds shared-machine sessions (washer / dryer / dishwasher) whose cycle has
// finished, marks them done, and pushes "the machine is free" to the whole
// house so nobody's laundry sits forgotten.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applianceDoneCopy, normalizeLang, type Lang } from '../_shared/notificationCopy.ts';
import { assertCronAuthorized } from '../_shared/cronAuth.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TIMEOUT_MS = 5000;
const PUSH_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Up to 3 attempts with exponential backoff (500ms, 1000ms), per this project's
// Edge Function notification rules (see AGENTS.md).
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

interface ClaimedSession {
  id: string;
  house_id: string;
  appliance: string;
}

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

  // Releases the claim on sessions we couldn't deliver, so the next run retries
  // them instead of the "free" notice silently going missing.
  async function releaseClaims(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    // Restore is_active so the row matches the next run's claim query
    // (is_active = true AND done_notified = false) and can actually be retried.
    const { error } = await supabase
      .from('appliance_sessions')
      .update({ is_active: true, done_notified: false })
      .in('id', ids);
    if (error) console.error('Failed to release appliance claims for retry', error.message);
  }

  try {
    const nowIso = new Date().toISOString();

    // Atomically claim finished cycles in one statement — two overlapping runs
    // can never both claim (and double-push) the same session.
    const { data: claimed, error } = await supabase
      .from('appliance_sessions')
      .update({ is_active: false, done_notified: true })
      .eq('is_active', true)
      .eq('done_notified', false)
      .lte('ends_at', nowIso)
      .select('id, house_id, appliance');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
    const sessions = (claimed ?? []) as ClaimedSession[];
    if (sessions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, sessions: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const houseIds = [...new Set(sessions.map((s) => s.house_id))];

    // Members of every affected house — the "free" push goes to all of them.
    const { data: memberRows, error: membersError } = await supabase
      .from('house_members')
      .select('house_id, user_id')
      .in('house_id', houseIds);
    if (membersError) {
      await releaseClaims(sessions.map((s) => s.id));
      return new Response(JSON.stringify({ error: membersError.message }), { status: 500 });
    }
    const membersByHouse = new Map<string, string[]>();
    for (const row of (memberRows ?? []) as Array<{ house_id: string; user_id: string }>) {
      const list = membersByHouse.get(row.house_id) ?? [];
      list.push(row.user_id);
      membersByHouse.set(row.house_id, list);
    }
    const allUserIds = [...new Set((memberRows ?? []).map((r) => r.user_id))];

    // Tokens for those members, and their per-user mute preference.
    const [tokenRes, prefRes] = await Promise.all([
      supabase
        .from('push_tokens')
        .select('token, user_id, house_id, language')
        .in('house_id', houseIds),
      allUserIds.length > 0
        ? supabase
            .from('notification_preferences')
            .select('user_id, house_id, notify_appliance_done')
            .in('house_id', houseIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (tokenRes.error) {
      await releaseClaims(sessions.map((s) => s.id));
      return new Response(JSON.stringify({ error: tokenRes.error.message }), { status: 500 });
    }
    if (prefRes.error) {
      await releaseClaims(sessions.map((s) => s.id));
      return new Response(JSON.stringify({ error: prefRes.error.message }), { status: 500 });
    }

    // Users who muted appliance notices for a given house — fail closed only on
    // an explicit false (no row = default on).
    const muted = new Set<string>();
    for (const row of (prefRes.data ?? []) as Array<{
      user_id: string;
      house_id: string;
      notify_appliance_done: boolean | null;
    }>) {
      if (row.notify_appliance_done === false) muted.add(`${row.user_id}:${row.house_id}`);
    }

    // Group tokens by user:house so each recipient's device language is honored.
    const tokensByUserHouse = new Map<string, Array<{ token: string; language: Lang }>>();
    for (const row of (tokenRes.data ?? []) as Array<{
      token: string;
      user_id: string;
      house_id: string;
      language?: string;
    }>) {
      if (!row.token) continue;
      const key = `${row.user_id}:${row.house_id}`;
      const list = tokensByUserHouse.get(key) ?? [];
      list.push({ token: row.token, language: normalizeLang(row.language) });
      tokensByUserHouse.set(key, list);
    }

    let totalSent = 0;
    const failedSessionIds: string[] = [];

    for (const session of sessions) {
      const members = membersByHouse.get(session.house_id) ?? [];
      const messages: unknown[] = [];
      for (const userId of members) {
        const key = `${userId}:${session.house_id}`;
        if (muted.has(key)) continue;
        for (const { token, language } of tokensByUserHouse.get(key) ?? []) {
          const copy = applianceDoneCopy(language, { appliance: session.appliance });
          messages.push({
            to: token,
            title: copy.title,
            body: copy.body,
            sound: 'default',
            priority: 'high',
            data: { screen: 'machines' },
          });
        }
      }
      if (messages.length === 0) continue;

      const delivered = await sendPushWithRetry(messages);
      if (delivered) {
        totalSent += messages.length;
      } else {
        console.error('Expo push failed after retries for appliance session', session.id);
        failedSessionIds.push(session.id);
      }
    }

    await releaseClaims(failedSessionIds);

    return new Response(JSON.stringify({ sent: totalSent, sessions: sessions.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('appliance-check failed', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500 }
    );
  }
});
