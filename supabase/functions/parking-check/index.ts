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

// Returns the current moment expressed in the given IANA timezone so we can
// compare against local-time start_time strings stored in the DB.
function getLocalContext(tz: string): { nowMins: number; today: string; tomorrow: string } {
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
  const hours = parseInt(parts['hour'] ?? '0', 10);
  const minutes = parseInt(parts['minute'] ?? '0', 10);
  const today = `${parts['year']}-${parts['month']}-${parts['day']}`;
  const dtfDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const tomorrow = dtfDate.format(new Date(now.getTime() + 86_400_000));
  return { nowMins: hours * 60 + minutes, today, tomorrow };
}

function utcDateStr(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type NotificationType = 'parking_reservation' | 'parking_claimed';

// Maps notification event types to the user-preference column in notification_preferences.
const PREF_COLUMN: Record<NotificationType, string> = {
  parking_reservation: 'notify_parking_reservation',
  parking_claimed: 'notify_parking_claimed',
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

interface HouseRow {
  id: string;
  timezone: string;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

async function sendToUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  houseId: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
  notificationType: NotificationType = 'parking_reservation'
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
  const messages = tokens.map((to) => ({
    to,
    title,
    body,
    data,
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
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<{ status: string; message?: string }> };
        const tickets = json.data ?? [];
        const failed = tickets.filter((t) => t.status !== 'ok');
        if (failed.length === 0) return true;
        for (const t of failed) {
          console.warn(`[parking-check] Expo ticket error: ${t.message ?? t.status}`);
        }
      } else {
        console.warn(`[parking-check] Expo push attempt ${attempt + 1} returned ${res.status}`);
      }
    } catch (err) {
      console.warn(`[parking-check] Expo push attempt ${attempt + 1} threw:`, err);
    }
    if (attempt < delays.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
  console.error('[parking-check] All push attempts failed');

  return false;
}

async function getNames(
  supabase: ReturnType<typeof createClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, name').in('id', userIds);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of (data ?? []) as UserProfile[]) {
    map.set(row.id, row.name);
  }
  return map;
}

Deno.serve(async (_req: Request): Promise<Response> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Broad UTC date window that covers any timezone's "today" and "tomorrow".
    // UTC±14 means local date can differ by at most ±1 day from UTC date, so
    // [-2 days, +3 days] around UTC today is a safe margin.
    const windowStart = utcDateStr(-2 * 86_400_000);
    const windowEnd = utcDateStr(3 * 86_400_000);

    // Fetch upcoming/active reservations across the wide window
    const { data: reservations, error: resErr } = await supabase
      .from('parking_reservations')
      .select('*')
      .in('status', ['approved', 'pending'])
      .gte('date', windowStart)
      .lte('date', windowEnd);
    if (resErr) {
      console.error('[parking-check] reservations fetch error:', resErr);
      return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch pending reservations strictly before the window (definitely past in all timezones)
    const { data: pastPending, error: pastErr } = await supabase
      .from('parking_reservations')
      .select('*')
      .eq('status', 'pending')
      .lt('date', windowStart);
    if (pastErr) {
      console.error('[parking-check] past-pending fetch error:', pastErr);
      return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const allReservations = [
      ...((reservations ?? []) as Reservation[]),
      ...((pastPending ?? []) as Reservation[]),
    ];

    // Pre-fetch votes for all pending reservations so we can tally at deadline
    const pendingIds = allReservations.filter((r) => r.status === 'pending').map((r) => r.id);
    const votesByReservation = new Map<string, Array<{ user_id: string; vote: string }>>();
    if (pendingIds.length > 0) {
      const { data: allVotes, error: votesErr } = await supabase
        .from('parking_reservation_votes')
        .select('reservation_id, user_id, vote')
        .in('reservation_id', pendingIds);
      if (votesErr) {
        console.error('[parking-check] votes fetch error:', votesErr.message);
        return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      for (const v of (allVotes ?? []) as Array<{
        reservation_id: string;
        user_id: string;
        vote: string;
      }>) {
        const arr = votesByReservation.get(v.reservation_id) ?? [];
        arr.push(v);
        votesByReservation.set(v.reservation_id, arr);
      }
    }

    // Fetch all active parking sessions
    const { data: sessions, error: sessErr } = await supabase
      .from('parking_sessions')
      .select('*')
      .eq('is_active', true);
    if (sessErr) {
      console.error('[parking-check] sessions fetch error:', sessErr);
      return new Response(JSON.stringify({ error: 'An internal error occurred' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const allSessions = (sessions ?? []) as Session[];

    // Get unique house IDs across reservations and sessions, then fetch timezones
    const houseIds = [
      ...new Set([
        ...allReservations.map((r) => r.house_id),
        ...allSessions.map((s) => s.house_id),
      ]),
    ];

    let houseTimezone = new Map<string, string>();
    if (houseIds.length > 0) {
      const { data: housesData, error: houseErr } = await supabase
        .from('houses')
        .select('id, timezone')
        .in('id', houseIds);
      if (houseErr) {
        console.error('[parking-check] houses fetch error:', houseErr);
      } else {
        houseTimezone = new Map(
          ((housesData ?? []) as HouseRow[]).map((h) => [h.id, h.timezone || 'UTC'])
        );
      }
    }

    // Pre-fetch house members per house (for non-voter calculation in reminders)
    const membersByHouse = new Map<string, string[]>();
    let membersError = false;
    if (houseIds.length > 0) {
      const { data: memberRows, error: membersErr } = await supabase
        .from('house_members')
        .select('house_id, user_id')
        .in('house_id', houseIds);
      if (membersErr) {
        console.error('[parking-check] house_members fetch error:', membersErr.message);
        membersError = true;
      } else {
        for (const m of (memberRows ?? []) as Array<{ house_id: string; user_id: string }>) {
          const arr = membersByHouse.get(m.house_id) ?? [];
          arr.push(m.user_id);
          membersByHouse.set(m.house_id, arr);
        }
      }
    }

    // Index sessions by house
    const sessionByHouse = new Map<string, Session>();
    for (const s of allSessions) sessionByHouse.set(s.house_id, s);

    // Group reservations by house
    const byHouse = new Map<string, Reservation[]>();
    for (const r of allReservations) {
      const list = byHouse.get(r.house_id) ?? [];
      list.push(r);
      byHouse.set(r.house_id, list);
    }

    // Collect all user IDs for the names lookup
    const allUserIds = new Set<string>();
    for (const r of allReservations) allUserIds.add(r.requested_by);
    for (const s of allSessions) allUserIds.add(s.occupant);
    const names = await getNames(supabase, Array.from(allUserIds));

    const updates: Array<{ id: string; patch: Partial<Reservation> }> = [];
    const allPairInserts: Array<{ a_id: string; b_id: string; house_id: string }> = [];

    // ── Process each house using its own local timezone ──────────────────────────
    for (const [houseId, houseReservations] of byHouse) {
      let tz = houseTimezone.get(houseId) ?? 'UTC';
      let localCtx: ReturnType<typeof getLocalContext>;
      try {
        localCtx = getLocalContext(tz);
      } catch {
        console.error(
          `[parking-check] invalid timezone "${tz}" for house ${houseId}, falling back to UTC`
        );
        tz = 'UTC';
        localCtx = getLocalContext('UTC');
      }
      const { nowMins, today, tomorrow } = localCtx;
      const session = sessionByHouse.get(houseId);

      for (const r of houseReservations) {
        const rName = names.get(r.requested_by) ?? 'A housemate';
        const timeStr = r.start_time ? ` at ${r.start_time}` : '';

        // ── #6a: Resolve pending reservations strictly in the past by vote tally ──
        if (r.status === 'pending' && r.date < today) {
          const castVotes = votesByReservation.get(r.id) ?? [];
          const approveCount = castVotes.filter((v) => v.vote === 'approve').length;
          const rejectCount = castVotes.filter((v) => v.vote === 'reject').length;
          const resolvedStatus = approveCount > rejectCount ? 'approved' : 'rejected';

          const { data: resolved6a, error: resolveErr } = await supabase
            .from('parking_reservations')
            .update({ status: resolvedStatus })
            .eq('id', r.id)
            .eq('status', 'pending') // guard: skip if already finalized by a concurrent vote
            .select('id');
          if (resolveErr) {
            console.error(
              '[parking-check] auto-resolve (#6a) failed for',
              r.id,
              resolveErr.message
            );
            continue;
          }
          if (!resolved6a?.length) continue; // already finalized — nothing to do
          if (resolvedStatus === 'approved') {
            await sendToUser(
              supabase,
              r.requested_by,
              r.house_id,
              '✅ Parking approved!',
              `Your request for ${r.date}${timeStr} was approved by the majority vote.`,
              { screen: 'parking' }
            );
          } else {
            await sendToUser(
              supabase,
              r.requested_by,
              r.house_id,
              '🅿️ Parking request expired',
              castVotes.length === 0
                ? `Your request for ${r.date}${timeStr} expired — no votes were cast.`
                : `Your request for ${r.date}${timeStr} expired — majority voted no.`,
              { screen: 'parking' }
            );
          }
          continue;
        }

        // ── #6b: Resolve today's pending by vote tally if start time has passed ──
        if (r.status === 'pending' && r.date === today) {
          const startMins = r.start_time ? toMinutes(r.start_time) : 0;
          if (nowMins >= startMins) {
            const castVotes = votesByReservation.get(r.id) ?? [];
            const approveCount = castVotes.filter((v) => v.vote === 'approve').length;
            const rejectCount = castVotes.filter((v) => v.vote === 'reject').length;
            const resolvedStatus = approveCount > rejectCount ? 'approved' : 'rejected';

            const { data: resolved6b, error: resolveErr } = await supabase
              .from('parking_reservations')
              .update({ status: resolvedStatus })
              .eq('id', r.id)
              .eq('status', 'pending') // guard: skip if already finalized by a concurrent vote
              .select('id');
            if (resolveErr) {
              console.error(
                '[parking-check] auto-resolve (#6b) failed for',
                r.id,
                resolveErr.message
              );
              continue;
            }
            if (!resolved6b?.length) continue; // already finalized — nothing to do
            if (resolvedStatus === 'approved') {
              await sendToUser(
                supabase,
                r.requested_by,
                r.house_id,
                '✅ Parking approved!',
                `Your request for today${timeStr} was approved by the majority vote.`,
                { screen: 'parking' }
              );
            } else {
              await sendToUser(
                supabase,
                r.requested_by,
                r.house_id,
                '🅿️ Parking request expired',
                castVotes.length === 0
                  ? `Your request for today${timeStr} expired — no votes were cast.`
                  : `Your request for today${timeStr} expired — majority voted no.`,
                { screen: 'parking' }
              );
            }
            continue;
          }
        }

        // ── #6c: 24h-before notice for tomorrow's pending reservations ────────────
        // Skip entirely when membersError is set — without the member list we can't
        // notify non-voters, so we must not set pending_notice_sent either. The next
        // cron run will retry once the member fetch recovers.
        if (
          r.status === 'pending' &&
          r.date === tomorrow &&
          !r.pending_notice_sent &&
          !membersError
        ) {
          const sentRequester = await sendToUser(
            supabase,
            r.requested_by,
            r.house_id,
            '⏳ Parking vote still open',
            `Your parking request for ${r.date}${timeStr} hasn't been decided yet — vote closes tomorrow.`,
            { screen: 'parking' }
          );

          // Also ping anyone who hasn't voted yet
          const houseMembers = membersByHouse.get(r.house_id) ?? [];
          const castVotes = votesByReservation.get(r.id) ?? [];
          const votedIds = new Set(castVotes.map((v) => v.user_id));
          const nonVoterIds = houseMembers.filter(
            (id) => id !== r.requested_by && !votedIds.has(id)
          );
          let sentNonVoter = false;
          for (const voterId of nonVoterIds) {
            const sent = await sendToUser(
              supabase,
              voterId,
              r.house_id,
              '🗳️ Vote before the deadline!',
              `${rName} wants the spot on ${r.date}${timeStr} — vote by tomorrow or the majority decides.`,
              { screen: 'parking' }
            );
            if (sent) sentNonVoter = true;
          }

          // Gate the flag on success and only when the member list was actually available.
          // If the member fetch errored, skip setting the flag so non-voters get reminded next run.
          if ((sentRequester || sentNonVoter) && !membersError)
            updates.push({ id: r.id, patch: { pending_notice_sent: true } });
        }

        if (r.status !== 'approved') continue;

        // ── Approved reservations only from here — and only on today's local date ──
        if (r.date !== today) continue;

        const startMins = r.start_time ? toMinutes(r.start_time) : 0;
        const endMins = r.end_time ? toMinutes(r.end_time) : 24 * 60;

        // ── #4: 30-min advance warning to current occupant ───────────────────────
        if (
          !r.advance_warning_sent &&
          session &&
          session.occupant !== r.requested_by &&
          startMins > nowMins &&
          startMins - nowMins <= 35
        ) {
          const occupantName = names.get(session.occupant) ?? 'Someone';
          const sentOccupant4 = await sendToUser(
            supabase,
            session.occupant,
            r.house_id,
            '🚗 Spot needed soon',
            `${rName} has the spot from ${r.start_time ?? 'soon'} — please free it up in time.`,
            { screen: 'parking' },
            'parking_claimed'
          );
          const sentRequester4 = await sendToUser(
            supabase,
            r.requested_by,
            r.house_id,
            '⏰ Spot still in use',
            `${occupantName} is still parked — we've reminded them your slot starts at ${r.start_time}.`,
            { screen: 'parking' },
            'parking_claimed'
          );
          if (sentOccupant4 && sentRequester4)
            updates.push({ id: r.id, patch: { advance_warning_sent: true } });
        }

        // ── #3: Spot still taken when reservation start time arrives ─────────────
        if (
          !r.spot_taken_notified &&
          session &&
          session.occupant !== r.requested_by &&
          nowMins >= startMins &&
          nowMins < endMins
        ) {
          const occupantName = names.get(session.occupant) ?? 'Someone';
          const sentOccupant3 = await sendToUser(
            supabase,
            session.occupant,
            r.house_id,
            '🚗 Please free the spot',
            `${rName}'s reserved slot started at ${r.start_time ?? 'now'}. Please free the spot.`,
            { screen: 'parking' },
            'parking_claimed'
          );
          const sentRequester3 = await sendToUser(
            supabase,
            r.requested_by,
            r.house_id,
            '⚠️ Spot still occupied',
            `Your slot started but ${occupantName} is still parked — they've been notified.`,
            { screen: 'parking' },
            'parking_claimed'
          );
          if (sentOccupant3 && sentRequester3)
            updates.push({ id: r.id, patch: { spot_taken_notified: true } });
        }
      }

      // ── #7: Back-to-back approved reservations on today's local date ───────────
      const todayApproved = houseReservations
        .filter((r) => r.status === 'approved' && r.date === today && r.start_time && r.end_time)
        .sort((a, b) => toMinutes(a.start_time!) - toMinutes(b.start_time!));

      if (todayApproved.length >= 2) {
        const todayIds = todayApproved.map((r) => r.id);
        const { data: existingPairs, error: pairsErr } = await supabase
          .from('parking_pair_notifications')
          .select('a_id, b_id')
          .in('a_id', todayIds);
        if (pairsErr)
          throw new Error(`[parking-check] pair notifications fetch failed: ${pairsErr.message}`);

        const notifiedPairs = new Set<string>();
        for (const row of (existingPairs ?? []) as { a_id: string; b_id: string }[]) {
          notifiedPairs.add(`${row.a_id}:${row.b_id}`);
        }

        for (let i = 0; i < todayApproved.length - 1; i++) {
          const a = todayApproved[i];
          const b = todayApproved[i + 1];
          const pairKey = `${a.id}:${b.id}`;
          if (notifiedPairs.has(pairKey) || (a.back_to_back_notified && b.back_to_back_notified))
            continue;

          const gap = toMinutes(b.start_time!) - toMinutes(a.end_time!);
          if (gap < 0 || gap > 120) continue;

          const aName = names.get(a.requested_by) ?? 'A housemate';
          const bName = names.get(b.requested_by) ?? 'A housemate';

          const sentA = await sendToUser(
            supabase,
            a.requested_by,
            a.house_id,
            '🅿️ Back-to-back reservation',
            `${bName} has the spot right after you (${b.start_time}) — coordinate timing.`,
            { screen: 'parking' }
          );
          const sentB = await sendToUser(
            supabase,
            b.requested_by,
            b.house_id,
            '🅿️ Back-to-back reservation',
            `${aName} has the spot right before you (ends ${a.end_time}) — coordinate timing.`,
            { screen: 'parking' }
          );
          if (sentA && sentB) {
            notifiedPairs.add(pairKey);
            allPairInserts.push({ a_id: a.id, b_id: b.id, house_id: a.house_id });
          }
        }
      }
    }

    // Flush flag updates
    const updateResults = await Promise.allSettled(
      updates.map(async ({ id, patch }) => {
        const { error } = await supabase.from('parking_reservations').update(patch).eq('id', id);
        if (error) throw new Error(`id=${id} patch=${JSON.stringify(patch)}: ${error.message}`);
      })
    );
    for (const result of updateResults) {
      if (result.status === 'rejected')
        console.error('[parking-check] flag update failed:', result.reason);
    }

    // Flush pair-level back-to-back notification records
    if (allPairInserts.length > 0) {
      const { error: pairInsertErr } = await supabase
        .from('parking_pair_notifications')
        .upsert(allPairInserts, { onConflict: 'a_id,b_id', ignoreDuplicates: true });
      if (pairInsertErr)
        console.error('[parking-check] pair notification insert failed:', pairInsertErr.message);
    }

    return new Response(
      JSON.stringify({
        processed: allReservations.length,
        updated: updates.length,
        pairs: allPairInserts.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[parking-check] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
