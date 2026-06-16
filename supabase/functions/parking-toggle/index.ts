// Housemates — parking-toggle Edge Function
// Called by an Apple Shortcut triggered by an NFC tag placed in the car.
// Auth:   Authorization: Bearer <nfc_parking_token>  (from profiles.nfc_parking_token)
// Action: Claims the spot if free; releases it if the caller already has it;
//         returns 409 if someone else has it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushTokenRow {
  token: string;
}

interface NotificationPrefRow {
  user_id: string;
  notify_parking_claimed: boolean | null;
}

interface MemberRow {
  user_id: string;
}

interface ReservationRow {
  requested_by: string;
  start_time: string | null;
  end_time: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toMinutes(time: string): number {
  const parts = time.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function todayInTimezone(tz: string): { dateStr: string; nowMinutes: number } {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  const dateStr = `${parts['year']}-${parts['month']}-${parts['day']}`;
  const nowMinutes = parseInt(parts['hour'] ?? '0', 10) * 60 + parseInt(parts['minute'] ?? '0', 10);
  return { dateStr, nowMinutes };
}

async function notifyHousemates(
  supabase: ReturnType<typeof createClient>,
  houseId: string,
  excludeUserId: string,
  title: string,
  body: string
): Promise<void> {
  const { data: members } = await supabase
    .from('house_members')
    .select('user_id')
    .eq('house_id', houseId)
    .neq('user_id', excludeUserId);

  const memberIds = ((members ?? []) as MemberRow[]).map((m) => m.user_id);
  if (memberIds.length === 0) return;

  // Respect notification preferences
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_id, notify_parking_claimed')
    .eq('house_id', houseId)
    .in('user_id', memberIds);

  const optedOut = new Set(
    ((prefs ?? []) as NotificationPrefRow[])
      .filter((p) => p.notify_parking_claimed === false)
      .map((p) => p.user_id)
  );

  const targetIds = memberIds.filter((id) => !optedOut.has(id));
  if (targetIds.length === 0) return;

  const { data: tokenRows } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('house_id', houseId)
    .in('user_id', targetIds);

  const tokens = ((tokenRows ?? []) as PushTokenRow[]).map((r) => r.token).filter(Boolean);
  if (tokens.length === 0) return;

  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data: { screen: 'parking' },
    sound: 'default',
    priority: 'high',
  }));

  const delays = [500, 1000, 2000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      if (res.ok) return;
      console.warn(`[parking-toggle] push attempt ${attempt + 1} returned ${res.status}`);
    } catch (err) {
      console.warn(`[parking-toggle] push attempt ${attempt + 1} threw:`, err);
    }
    if (attempt < delays.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
  console.error('[parking-toggle] All push attempts failed');
}

Deno.serve(async (req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Server configuration error' }, 500);
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json({ error: 'Missing authorization token' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Resolve token → user
  const { data: profileRow, error: profileErr } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('nfc_parking_token', token)
    .maybeSingle();

  if (profileErr || !profileRow) {
    return json({ error: 'Invalid token' }, 401);
  }

  const userId = (profileRow as { id: string; name: string }).id;
  const displayName = (profileRow as { id: string; name: string }).name;

  // Resolve user → house
  const { data: memberRow, error: memberErr } = await supabase
    .from('house_members')
    .select('house_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (memberErr || !memberRow) {
    return json({ error: 'User is not a member of any house' }, 404);
  }

  const houseId = (memberRow as { house_id: string }).house_id;

  // ── Current parking state ─────────────────────────────────────────────────────
  const { data: sessions, error: sessionErr } = await supabase
    .from('parking_sessions')
    .select('id, occupant')
    .eq('house_id', houseId)
    .eq('is_active', true)
    .limit(1);

  if (sessionErr) {
    return json({ error: 'Could not read parking state' }, 500);
  }

  const current = ((sessions ?? []) as { id: string; occupant: string }[])[0] ?? null;

  // ── Claim ─────────────────────────────────────────────────────────────────────
  if (!current) {
    // Check for a housemate's approved reservation that covers right now
    const { data: houseRow } = await supabase
      .from('houses')
      .select('timezone')
      .eq('id', houseId)
      .maybeSingle();
    const tz = (houseRow as { timezone: string } | null)?.timezone || 'UTC';
    const { dateStr, nowMinutes } = todayInTimezone(tz);

    const { data: reservations } = await supabase
      .from('parking_reservations')
      .select('requested_by, start_time, end_time')
      .eq('house_id', houseId)
      .eq('status', 'approved')
      .eq('date', dateStr);

    const blocked = ((reservations ?? []) as ReservationRow[]).find((r) => {
      if (r.requested_by === userId) return false;
      const start = r.start_time ? toMinutes(r.start_time) : 0;
      const end = r.end_time ? toMinutes(r.end_time) : 24 * 60;
      return nowMinutes >= start && nowMinutes < end;
    });

    if (blocked) {
      return json(
        { action: 'blocked', message: 'The spot is reserved by a housemate right now' },
        409
      );
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('parking_sessions')
      .insert({ house_id: houseId, occupant: userId, is_active: true })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      return json({ error: 'Could not claim the parking spot' }, 500);
    }

    await notifyHousemates(
      supabase,
      houseId,
      userId,
      '🚗 Spot taken!',
      `${displayName} nabbed the parking spot. First come, first parked 🏎️`
    );

    return json({ action: 'claimed', message: `Parking claimed — you're in the spot!` });
  }

  // ── Release ───────────────────────────────────────────────────────────────────
  if (current.occupant === userId) {
    const { error: updateErr } = await supabase
      .from('parking_sessions')
      .update({ is_active: false })
      .eq('id', current.id)
      .eq('house_id', houseId);

    if (updateErr) {
      return json({ error: 'Could not release the parking spot' }, 500);
    }

    await notifyHousemates(
      supabase,
      houseId,
      userId,
      "🅿️ Spot's free — go go go!",
      `${displayName} freed the spot. Quick, claim it! 🏃`
    );

    return json({ action: 'released', message: `Parking released — spot is now free.` });
  }

  // ── Blocked ───────────────────────────────────────────────────────────────────
  return json({ action: 'blocked', message: 'The spot is already taken by someone else' }, 409);
});
