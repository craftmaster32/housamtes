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
): Promise<void> {
  const { data: rows } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('house_id', houseId)
    .eq('user_id', userId);

  const tokens = ((rows ?? []) as PushToken[]).map((r) => r.token).filter(Boolean);
  if (tokens.length === 0) return;

  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(tokens.map((to) => ({ to, title, body, data, sound: 'default', priority: 'high' }))),
  });
}

async function getNames(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', userIds);

  const map = new Map<string, string>();
  for (const row of ((data ?? []) as UserProfile[])) {
    map.set(row.id, row.name);
  }
  return map;
}

Deno.serve(async (_req: Request) => {
  const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase       = createClient(supabaseUrl, serviceRoleKey);

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
  const { data: pastPending } = await supabase
    .from('parking_reservations')
    .select('*')
    .eq('status', 'pending')
    .lt('date', today);

  const allReservations = [
    ...((reservations ?? []) as Reservation[]),
    ...((pastPending ?? []) as Reservation[]),
  ];

  // Fetch all active parking sessions
  const { data: sessions } = await supabase
    .from('parking_sessions')
    .select('*')
    .eq('is_active', true);

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
      await supabase
        .from('parking_reservations')
        .update({ status: 'rejected' })
        .eq('id', r.id);

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
        await supabase
          .from('parking_reservations')
          .update({ status: 'rejected' })
          .eq('id', r.id);

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
      const shouldNotify = hoursOld >= 20 || hoursUntil <= 2;

      if (shouldNotify) {
        await sendToUser(supabase, r.requested_by, r.house_id,
          '⏳ Parking vote still open',
          `Your parking request for ${r.date}${timeStr} hasn't been voted on yet.`,
          { screen: 'parking' },
        );
        updates.push({ id: r.id, patch: { pending_notice_sent: true } });
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
      await sendToUser(supabase, session.occupant, r.house_id,
        '🚗 Spot needed soon',
        `${rName} has the spot from ${r.start_time ?? 'soon'} — please free it up in time.`,
        { screen: 'parking' },
      );
      // Also give the reservation holder a heads-up that occupant was notified
      await sendToUser(supabase, r.requested_by, r.house_id,
        '⏰ Spot still in use',
        `${occupantName} is still parked — we've reminded them your slot starts at ${r.start_time}.`,
        { screen: 'parking' },
      );
      updates.push({ id: r.id, patch: { advance_warning_sent: true } });
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
      await sendToUser(supabase, session.occupant, r.house_id,
        '🚗 Please free the spot',
        `${rName}'s reserved slot started at ${r.start_time ?? 'now'}. Please free the spot.`,
        { screen: 'parking' },
      );
      await sendToUser(supabase, r.requested_by, r.house_id,
        '⚠️ Spot still occupied',
        `Your slot started but ${occupantName} is still parked — they've been notified.`,
        { screen: 'parking' },
      );
      updates.push({ id: r.id, patch: { spot_taken_notified: true } });
    }
  }

  // ── #7: Back-to-back approved reservations on the same day ──────────────────
  for (const [, houseReservations] of byHouse) {
    const todayApproved = houseReservations
      .filter((r) => r.status === 'approved' && r.date === today && r.start_time && r.end_time)
      .sort((a, b) => toMinutes(a.start_time!) - toMinutes(b.start_time!));

    for (let i = 0; i < todayApproved.length - 1; i++) {
      const a = todayApproved[i];
      const b = todayApproved[i + 1];
      if (a.back_to_back_notified || b.back_to_back_notified) continue;

      const gap = toMinutes(b.start_time!) - toMinutes(a.end_time!);
      if (gap > 120) continue;

      const aName = names.get(a.requested_by) ?? 'A housemate';
      const bName = names.get(b.requested_by) ?? 'A housemate';

      await sendToUser(supabase, a.requested_by, a.house_id,
        '🅿️ Back-to-back reservation',
        `${bName} has the spot right after you (${b.start_time}) — coordinate timing.`,
        { screen: 'parking' },
      );
      await sendToUser(supabase, b.requested_by, b.house_id,
        '🅿️ Back-to-back reservation',
        `${aName} has the spot right before you (ends ${a.end_time}) — coordinate timing.`,
        { screen: 'parking' },
      );
      updates.push({ id: a.id, patch: { back_to_back_notified: true } });
      updates.push({ id: b.id, patch: { back_to_back_notified: true } });
    }
  }

  // Flush all flag updates
  await Promise.all(
    updates.map(({ id, patch }) =>
      supabase.from('parking_reservations').update(patch).eq('id', id)
    )
  );

  return new Response(
    JSON.stringify({ processed: allReservations.length, updated: updates.length }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
