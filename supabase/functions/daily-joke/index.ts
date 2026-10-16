// HouseMates — daily-joke Edge Function
// Schedule: once a day (e.g. 09:00) via Supabase cron (set up in dashboard).
// Sends everyone a dad joke in their own language, unless they've turned the
// "Daily dad joke" notification off in Settings.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeLang } from '../_shared/notificationCopy.ts';
import { dailyJokeTitle, pickDailyJoke } from '../_shared/dailyJokes.ts';
import { assertCronAuthorized } from '../_shared/cronAuth.ts';
import { fetchPushDevices, sendPush, type PushDevice } from '../_shared/push.ts';

Deno.serve(async (req: Request) => {
  const denied = assertCronAuthorized(req);
  if (denied) return denied;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let tokenRows: PushDevice[];
  try {
    tokenRows = await fetchPushDevices(supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Device lookup failed';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
  if (tokenRows.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No push tokens' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Respect the per-user opt-out (default on when no row / column is set).
  const { data: prefRows } = await supabase
    .from('notification_preferences')
    .select('user_id, house_id, notify_daily_joke');

  const optedOut = new Set<string>(
    (
      (prefRows ?? []) as Array<{
        user_id: string;
        house_id: string;
        notify_daily_joke: boolean | null;
      }>
    )
      .filter((p) => p.notify_daily_joke === false)
      .map((p) => `${p.user_id}:${p.house_id}`)
  );

  const now = new Date();

  const messages = tokenRows
    .filter((r) => !optedOut.has(`${r.user_id}:${r.house_id}`))
    .map((r) => {
      const lang = normalizeLang(r.language);
      const joke = pickDailyJoke(lang, now);
      return {
        to: r.token,
        title: dailyJokeTitle(lang),
        body: `${joke.setup} … ${joke.punchline}`,
        sound: 'default',
        data: { screen: 'games' },
        web: r.web,
      };
    });

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'Everyone opted out' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await sendPush(supabase, messages);

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
