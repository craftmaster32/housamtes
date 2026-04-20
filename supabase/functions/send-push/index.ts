// Housemates — send-push Edge Function
// Called by the app after key events (new bill, parking claim, chat message, etc.)
// Sends to both Expo push tokens (native) and web push subscriptions (browser).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const PREF_COLUMN: Record<string, string> = {
  bill_added:           'notify_bill_added',
  bill_settled:         'notify_bill_settled',
  bill_due:             'notify_bill_due',
  parking_claimed:      'notify_parking_claimed',
  parking_reservation:  'notify_parking_reservation',
  chore_overdue:        'notify_chore_overdue',
  chat_message:         'notify_chat_message',
};

interface SendPushPayload {
  house_id: string;
  exclude_user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  notification_type?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS, status: 200 });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }

  let payload: SendPushPayload;
  try {
    payload = await req.json() as SendPushPayload;
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
  }

  const { house_id, exclude_user_id, title, body, data, notification_type } = payload;

  const { data: membership } = await supabase
    .from('house_members')
    .select('id')
    .eq('house_id', house_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return new Response('Forbidden', { status: 403, headers: CORS_HEADERS });
  }

  // ── Fetch tokens + subscriptions for this house (excluding sender) ──────────
  const [tokenResult, webSubResult] = await Promise.all([
    supabase.from('push_tokens').select('token, user_id').eq('house_id', house_id).neq('user_id', exclude_user_id),
    supabase.from('web_push_subscriptions').select('endpoint, p256dh, auth, user_id').eq('house_id', house_id).neq('user_id', exclude_user_id),
  ]);

  const tokenRows = tokenResult.data ?? [];
  const webSubRows = webSubResult.data ?? [];

  // ── Fetch notification preferences for all relevant users ───────────────────
  const allUserIds = [...new Set([
    ...tokenRows.map((r: { user_id: string }) => r.user_id),
    ...webSubRows.map((r: { user_id: string }) => r.user_id),
  ])];

  const { data: prefRows } = allUserIds.length > 0
    ? await supabase
        .from('notification_preferences')
        .select('user_id, notify_bill_added, notify_bill_settled, notify_bill_due, notify_parking_claimed, notify_parking_reservation, notify_chore_overdue, notify_chat_message')
        .eq('house_id', house_id)
        .in('user_id', allUserIds)
    : { data: [] };

  const prefMap = new Map<string, Record<string, boolean>>();
  for (const row of (prefRows ?? [])) {
    prefMap.set(row.user_id, row as Record<string, boolean>);
  }

  const prefColumn = notification_type ? PREF_COLUMN[notification_type] : null;

  function isEnabled(userId: string): boolean {
    // Unknown notification_type → fail closed (don't send) so future types never
    // accidentally bypass per-user mute preferences before they're wired up.
    if (notification_type && !prefColumn) return false;
    if (!prefColumn) return true;
    const prefs = prefMap.get(userId);
    if (!prefs) return true; // no prefs row = all enabled by default
    return prefs[prefColumn] !== false;
  }

  // ── Send Expo push (native) ─────────────────────────────────────────────────
  const expoTokens = tokenRows
    .filter((r: { user_id: string; token: string }) => isEnabled(r.user_id))
    .map((r: { token: string }) => r.token)
    .filter(Boolean) as string[];

  let expoSent = 0;
  if (expoTokens.length > 0) {
    const messages = expoTokens.map((to) => ({
      to, title, body, data: data ?? {}, sound: 'default', priority: 'high',
    }));
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const expoBody = await expoRes.json() as { data?: Array<{ status: string; details?: { error?: string } }> };
    const tickets = expoBody.data ?? [];

    // Remove tokens that Expo says are no longer registered
    const badTokens = tickets
      .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? expoTokens[i] : null))
      .filter((t): t is string => t !== null);
    if (badTokens.length > 0) {
      await supabase.from('push_tokens').delete().in('token', badTokens);
    }

    expoSent = tickets.filter((t) => t.status === 'ok').length;
  }

  // ── Send Web push (browser) ─────────────────────────────────────────────────
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  let webSent = 0;

  const vapidContact = Deno.env.get('VAPID_CONTACT_EMAIL');
  if (vapidPublicKey && vapidPrivateKey && vapidContact && webSubRows.length > 0) {
    webpush.setVapidDetails(
      `mailto:${vapidContact}`,
      vapidPublicKey,
      vapidPrivateKey
    );

    const eligibleSubs = webSubRows.filter((r: { user_id: string }) => isEnabled(r.user_id));
    const webPayload = JSON.stringify({ title, body, data: data ?? {} });

    console.log(`[send-push] web subs total=${webSubRows.length} eligible=${eligibleSubs.length}`);

    const webResults = await Promise.allSettled(
      eligibleSubs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          webPayload
        )
      )
    );

    // Clean up expired subscriptions (HTTP 410 = subscription no longer valid)
    const expiredEndpoints: string[] = [];
    webResults.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        console.log(`[send-push] web push ok for sub ${i}`);
      } else {
        console.error(`[send-push] web push failed for sub ${i}:`, JSON.stringify(result.reason));
        if ((result.reason as { statusCode?: number })?.statusCode === 410) {
          expiredEndpoints.push(eligibleSubs[i].endpoint);
        }
      }
    });
    if (expiredEndpoints.length > 0) {
      await supabase.from('web_push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    webSent = webResults.filter((r) => r.status === 'fulfilled').length;
  }

  return new Response(JSON.stringify({ expo: expoSent, web: webSent }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
