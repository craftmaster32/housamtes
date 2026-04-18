// Housemates — send-push Edge Function
// Called by the app after key events (new bill, parking claim, chat message, etc.)
// Sends to both Expo push tokens (native) and web push subscriptions (browser).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

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
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload: SendPushPayload;
  try {
    payload = await req.json() as SendPushPayload;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { house_id, exclude_user_id, title, body, data, notification_type } = payload;

  const { data: membership } = await supabase
    .from('house_members')
    .select('id')
    .eq('house_id', house_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return new Response('Forbidden', { status: 403 });
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
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    expoSent = expoTokens.length;
  }

  // ── Send Web push (browser) ─────────────────────────────────────────────────
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  let webSent = 0;

  if (vapidPublicKey && vapidPrivateKey && webSubRows.length > 0) {
    webpush.setVapidDetails(
      'mailto:liorhalivner@gmail.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const eligibleSubs = webSubRows.filter((r: { user_id: string }) => isEnabled(r.user_id));
    const webPayload = JSON.stringify({ title, body, data: data ?? {} });

    await Promise.allSettled(
      eligibleSubs.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          webPayload
        )
      )
    );
    webSent = eligibleSubs.length;
  }

  return new Response(JSON.stringify({ expo: expoSent, web: webSent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
