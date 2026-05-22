// Housemates — parking-check Edge Function
// Schedule: every 30 minutes via Supabase cron (set up in dashboard).
//
// Handles four time-sensitive parking scenarios:
//   #3  Spot still taken when a reservation's start time arrives → notify both parties
//   #4  30-min advance warning to current occupant before a reservation starts
//   #6  Pending reservation approaching date → notice; date passed or time reached → auto-reject
//   #7  Two approved reservations on same day within 2h of each other → notify both holders

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Maps notification event types to the user-preference column in notification_preferences.
const PREF_COLUMN: Record<string, string> = {
  parking_reservation: 'notify_parking_reservation',
  parking_claimed:     'notify_parking_claimed',
};

interface Reservation {
  id: string;
  house_id: string;
  requested_by: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  pending_notice_sent: boolean;
  advance_warning_sent: boolean;
  spot_taken_notified: boolean;
  back_to_back_notified: boolean;
}

interface Session {
  id: string;
  house_id: string;
  occupant: string;
  is_active: boolean;
}

interface PushToken {
  user_id: string;
  token: string;
}

interface UserProfile {
  id: string;
  name: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function todayStr(now: Date): string {
  return now.toISOString().split('T')[0];
}

function tomorrowStr(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

async function sendToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  houseId: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
  notificationType = 'parking_reservation',
): Promise<boolean> {
  // 1. Check notification preferences — fail closed on DB error
  const prefColumn = PREF_COLUMN[notificationType];
  if (prefColumn) {
    const { data: prefs, error: prefErr } = await supabase
      .from('notification_preferences')
      .select(prefColumn)
      .eq('house_id', houseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (prefErr) {
      console.error('[parking-check] preferences fetch error:', prefErr.message);
      return false;
    }
    if (prefs && (prefs as Record<string, unknown>)[prefColumn] === false) return false;
  }

  // 2. Fetch push tokens
  const { data: rows, error: tokErr } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('house_id', houseId)
    .eq('user_id', userId);
  if (tokErr) {
    console.error('[parking-check] push_tokens fetch error:', tokErr.message);
    return false;
  }

  const tokens = ((rows ?? []) as PushToken[]).map((r) => r.token).filter(Boolean);
  if (tokens.length === 0) return false;

  // 3. Send with exponential-backoff retry (3 attempts: 500 ms, 1 s, 2 s)
  const messages = tokens.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' }));
  const delays = [500, 1000, 2000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      if (res.ok) return true;
      console.warn(`[parking-check] Expo push attempt ${attempt + 1} returned ${res.status}`);
    } catch (err) {
      console.warn(`[parking-check] Expo push attempt ${attempt + 1} threw:`, err);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, delays[attempt]));
  }
  console.error('[parking-check] All push attempts failed (houseId:', houseId, ')');

  return false;
}

async function getNames(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds);
  if (error) console.error('[parking-check] profiles fetch error:', error.message);

  const map = new Map<string, string>();
  for (const row of ((data ?? []) as UserProfile[])) {
    map.set(row.id, row.name);
  }
  return map;
}

Deno.serve(async (_req: Request): Promise<Response> => {
  const supabaseUrl    = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500 },
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const now        = new Date();
  const nowMins    = now.getHours() * 60 + now.getMinutes();
  const today      = todayStr(now);
  const tomorrow   = tomorrowStr(now);

  // Fetch all upcoming/active reservations (today + tomorrow) and past pending ones
  const { data: reservations, error: resErr } = await supabase
    .from('parking_reservations')
    .select('*')
    .in('status', ['approved', 'pending'])
    .gte('date', today);

  if (resErr) {
    return new Response(JSON.stringify({ error: resErr.message }), { status: 500 });
  }

  // Also fetch past pending reservations for auto-reject
  const { data: pastPending, error: pastErr } = await supabase
    .from('parking_reservations')
    .select('*')
    .eq('status', 'pending')
    .lt('date', today);
  if (pastErr) {
    return new Response(JSON.stringify({ error: pastErr.message }), { status: 500 });
  }

  const allReservations = [
    ...((reservations ?? []) as Reservation[]),
    ...((pastPending ?? []) as Reservation[]),
  ];

  // Fetch all active parking sessions
  const { data: sessions, error: sessErr } = await supabase
    .from('parking_sessions')
    .select('*')
    .eq('is_active', true);
  if (sessErr) {
    return new Response(JSON.stringify({ error: sessErr.message }), { status: 500 });
  }

  const sessionByHouse = new Map<string, Session>();
  for (const s of ((sessions ?? []) as Session[])) {
    sessionByHouse.set(s.house_id, s);
  }

  // Group reservations by house for #7 back-to-back check
  const byHouse = new Map<string, Reservation[]>();
  for (const r of allReservations) {
    const list = byHouse.get(r.house_id) ?? [];
    list.push(r);
    byHouse.set(r.house_id, list);
  }

  // Collect all user IDs we'll need names for
  const allUserIds = new Set<string>();
  for (const r of allReservations) {
    allUserIds.add(r.requested_by);
  }
  for (const s of ((sessions ?? []) as Session[])) {
    allUserIds.add(s.occupant);
  }
  const names = await getNames(supabase, Array.from(allUserIds));

  const updates: Array<{ id: string; patch: Partial<Reservation> }> = [];

  for (const r of allReservations) {
    const session = sessionByHouse.get(r.house_id);
    const rName   = names.get(r.requested_by) ?? 'A housemate';
    const timeStr = r.start_time ? ` at ${r.start_time}` : '';

    // ── #6a: Auto-reject past pending reservations ───────────────────────────
    if (r.status === 'pending' && r.date < today) {
      const { error: rejErr } = await supabase
        .from('parking_reservations')
        .update({ status: 'rejected' })
        .eq('id', r.id);
      if (rejErr) {
        console.error('[parking-check] auto-reject (#6a) failed for', r.id, rejErr.message);
        continue;
      }
      await sendToUser(supabase, r.requested_by, r.house_id,
        '🅿️ Parking request expired',
        `Your request for ${r.date}${timeStr} was auto-rejected — no vote was completed in time.`,
        { screen: 'parking' },
      );
      continue;
    }

    // ── #6b: Auto-reject today's pending reservation if start time has passed ─
    if (r.status === 'pending' && r.date === today) {
      const startMins = r.start_time ? toMinutes(r.start_time) : 0;
      if (nowMins >= startMins) {
        const { error: rejErr } = await supabase
          .from('parking_reservations')
          .update({ status: 'rejected' })
          .eq('id', r.id);
        if (rejErr) {
          console.error('[parking-check] auto-reject (#6b) failed for', r.id, rejErr.message);
          continue;
        }
        await sendToUser(supabase, r.requested_by, r.house_id,
          '🅿️ Parking request expired',
          `Your request for today${timeStr} was auto-rejected — no vote was completed in time.`,
          { screen: 'parking' },
        );
        continue;
      }
    }

    // ── #6c: 24h-before notice for tomorrow's pending reservations ────────────
    if (r.status === 'pending' && r.date === tomorrow && !r.pending_notice_sent) {
      const createdAt    = new Date(r.created_at);
      const reservDate   = new Date(`${r.date}T${r.start_time ?? '00:00'}:00`);
      const hoursUntil   = (reservDate.getTime() - now.getTime()) / 3_600_000;
      const hoursOld     = (now.getTime() - createdAt.getTime()) / 3_600_000;
      // Send if: created >24h ago (standard notice), or created <24h ago but within 2h of slot
      const shouldNotify = hoursOld >= 24 || hoursUntil <= 2;

      if (shouldNotify) {
        const sent = await sendToUser(supabase, r.requested_by, r.house_id,
          '⏳ Parking vote still open',
          `Your parking request for ${r.date}${timeStr} hasn't been voted on yet.`,
          { screen: 'parking' },
        );
        if (sent) updates.push({ id: r.id, patch: { pending_notice_sent: true } });
      }
    }

    if (r.status !== 'approved') continue;

    // Approved reservations only from here ────────────────────────────────────

    if (r.date !== today) continue; // #3 and #4 only fire on today's date

    const startMins = r.start_time ? toMinutes(r.start_time) : 0;
    const endMins   = r.end_time   ? toMinutes(r.end_time)   : 24 * 60;

    // ── #4: 30-min advance warning to current occupant ────────────────────────
    if (
      !r.advance_warning_sent &&
      session &&
      session.occupant !== r.requested_by &&
      startMins > nowMins &&
      startMins - nowMins <= 35 // 5-min tolerance window
    ) {
      const occupantName = names.get(session.occupant) ?? 'Someone';
      const sentOccupant4 = await sendToUser(supabase, session.occupant, r.house_id,
        '🚗 Spot needed soon',
        `${rName} has the spot from ${r.start_time ?? 'soon'} — please free it up in time.`,
        { screen: 'parking' },
      );
      // Also give the reservation holder a heads-up that occupant was notified
      const sentRequester4 = await sendToUser(supabase, r.requested_by, r.house_id,
        '⏰ Spot still in use',
        `${occupantName} is still parked — we've reminded them your slot starts at ${r.start_time}.`,
        { screen: 'parking' },
      );
      if (sentOccupant4 && sentRequester4) updates.push({ id: r.id, patch: { advance_warning_sent: true } });
    }

    // ── #3: Spot taken when reservation start time has arrived ────────────────
    if (
      !r.spot_taken_notified &&
      session &&
      session.occupant !== r.requested_by &&
      nowMins >= startMins &&
      nowMins < endMins
    ) {
      const occupantName = names.get(session.occupant) ?? 'Someone';
      const sentOccupant3 = await sendToUser(supabase, session.occupant, r.house_id,
        '🚗 Please free the spot',
        `${rName}'s reserved slot started at ${r.start_time ?? 'now'}. Please free the spot.`,
        { screen: 'parking' },
      );
      const sentRequester3 = await sendToUser(supabase, r.requested_by, r.house_id,
        '⚠️ Spot still occupied',
        `Your slot started but ${occupantName} is still parked — they've been notified.`,
        { screen: 'parking' },
      );
      if (sentOccupant3 && sentRequester3) updates.push({ id: r.id, patch: { spot_taken_notified: true } });
    }
  }

  // ── #7: Back-to-back approved reservations on the same day ──────────────────
  for (const [, houseReservations] of byHouse) {
    const todayApproved = houseReservations
      .filter((r) => r.status === 'approved' && r.date === today && r.start_time && r.end_time)
      .sort((a, b) => toMinutes(a.start_time!) - toMinutes(b.start_time!));

    const notifiedIds = new Set<string>();
    for (let i = 0; i < todayApproved.length - 1; i++) {
      const a = todayApproved[i];
      const b = todayApproved[i + 1];
      // Check both the persisted flag AND the local set so a middle reservation
      // that was already paired this run is not notified a second time.
      if (
        a.back_to_back_notified || b.back_to_back_notified ||
        notifiedIds.has(a.id)   || notifiedIds.has(b.id)
      ) continue;

      const gap = toMinutes(b.start_time!) - toMinutes(a.end_time!);
      if (gap > 120) continue;

      const aName = names.get(a.requested_by) ?? 'A housemate';
      const bName = names.get(b.requested_by) ?? 'A housemate';

      const sentA = await sendToUser(supabase, a.requested_by, a.house_id,
        '🅿️ Back-to-back reservation',
        `${bName} has the spot right after you (${b.start_time}) — coordinate timing.`,
        { screen: 'parking' },
      );
      const sentB = await sendToUser(supabase, b.requested_by, b.house_id,
        '🅿️ Back-to-back reservation',
        `${aName} has the spot right before you (ends ${a.end_time}) — coordinate timing.`,
        { screen: 'parking' },
      );
      // Always track in local set to prevent double-notifying within this run
      notifiedIds.add(a.id);
      notifiedIds.add(b.id);
      if (sentA) updates.push({ id: a.id, patch: { back_to_back_notified: true } });
      if (sentB) updates.push({ id: b.id, patch: { back_to_back_notified: true } });
    }
  }

  // Flush all flag updates; log but don't abort on partial failure
  const updateResults = await Promise.allSettled(
    updates.map(async ({ id, patch }) => {
      const { error } = await supabase
        .from('parking_reservations')
        .update(patch)
        .eq('id', id);
      if (error) throw new Error(`id=${id} patch=${JSON.stringify(patch)}: ${error.message}`);
    })
  );
  for (const result of updateResults) {
    if (result.status === 'rejected') {
      console.error('[parking-check] flag update failed:', result.reason);
    }
  }

  return new Response(
    JSON.stringify({ processed: allReservations.length, updated: updates.length }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
