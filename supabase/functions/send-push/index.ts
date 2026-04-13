// HouseMates — send-push Edge Function
// Called by the app after key events (new bill, parking claim, etc.)
// Fetches push tokens for all house members (except the sender),
// respects each user's notification preferences, then sends via the Expo Push API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Maps notification_type string → notification_preferences column name
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

  // Verify the caller is an authenticated HouseMates user
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

  // Verify the caller is a member of this house
  const { data: membership } = await supabase
    .from('house_members')
    .select('id')
    .eq('house_id', house_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return new Response('Forbidden', { status: 403 });
  }

  // Fetch push tokens for all house members except the sender
  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('token, user_id')
    .eq('house_id', house_id)
    .neq('user_id', exclude_user_id);

  if (!tokenRows || tokenRows.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Fetch notification preferences for all relevant users in this house
  const userIds = tokenRows.map((r: { user_id: string }) => r.user_id);
  const { data: prefRows } = await supabase
    .from('notification_preferences')
    .select('user_id, notify_bill_added, notify_bill_settled, notify_bill_due, notify_parking_claimed, notify_parking_reservation, notify_chore_overdue, notify_chat_message')
    .eq('house_id', house_id)
    .in('user_id', userIds);

  // Build user_id → prefs map
  const prefMap = new Map<string, Record<string, boolean>>();
  for (const row of (prefRows ?? [])) {
    prefMap.set(row.user_id, row as Record<string, boolean>);
  }

  // Filter: only send to users who have this notification enabled (default: true if no prefs row)
  const prefColumn = notification_type ? PREF_COLUMN[notification_type] : null;
  const filteredTokens = tokenRows
    .filter((r: { user_id: string; token: string }) => {
      if (!prefColumn) return true; // unknown type → send to all
      const prefs = prefMap.get(r.user_id);
      if (!prefs) return true; // no prefs row = use defaults (all enabled)
      return prefs[prefColumn] !== false;
    })
    .map((r: { token: string }) => r.token)
    .filter(Boolean) as string[];

  if (filteredTokens.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Send via Expo Push API
  const messages = filteredTokens.map((to) => ({
    to,
    title,
    body,
    data: data ?? {},
    sound: 'default',
    priority: 'high',
  }));

  const expoRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const result = await expoRes.json();

  return new Response(JSON.stringify({ sent: filteredTokens.length, result }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
