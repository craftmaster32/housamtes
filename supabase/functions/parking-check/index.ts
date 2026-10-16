// Housemates — parking-check Edge Function
// Schedule: every 30 minutes via Supabase cron (set up in dashboard).
//
// Handles four time-sensitive parking scenarios:
//   #3  Spot still taken when a reservation's start time arrives → notify both parties
//   #4  ~2-hour advance warning to current occupant before a reservation starts
//   #5  Slot started and the spot is free → mark it as the holder's (once per reservation)
//   #6  Pending reservation approaching date → notice; date passed or time reached → auto-reject
//   #7  Two approved reservations on same day within 2h of each other → notify both holders

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchPushDevices, sendPush } from '../_shared/push.ts';

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
  auto_claimed: boolean;
}

interface Session {
  id: string;
  house_id: string;
  occupant: string;
  is_active: boolean;
}

interface UserProfile {
  id: string;
  name: string;
}

interface HouseRow {
  id: string;
  timezone: string;
}

// Mirrors tallyParkingReservationVotes in the app: a side wins early once it
// can't be overtaken, or once it holds at least half of the eligible voters
// while ahead of the other side (house rule: half is enough).
function earlyDecision(
  approveCount: number,
  rejectCount: number,
  eligibleCount: number
): 'approved' | 'rejected' | null {
  const remaining = eligibleCount - approveCount - rejectCount;
  const half = eligibleCount / 2;
  if (approveCount > rejectCount + remaining) return 'approved';
  if (rejectCount > approveCount + remaining) return 'rejected';
  if (approveCount > 0 && approveCount >= half && approveCount > rejectCount) return 'approved';
  if (rejectCount > 0 && rejectCount >= half && rejectCount > approveCount) return 'rejected';
  return null;
}

// How long before a reservation starts the parked housemate is asked to move.
const ADVANCE_WARNING_MINUTES = 120;

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

  // 2. Deliver to every native and web device this person has in the house
  try {
    const devices = await fetchPushDevices(supabase, { houseIds: [houseId], userIds: [userId] });
    return await sendPush(
      supabase,
      devices.map((d) => ({
        to: d.token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        web: d.web,
      }))
    );
  } catch (err) {
    console.error('[parking-check] push delivery failed:', err);
    return false;
  }
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
    // Pre-seed so houses with zero DB rows get [] rather than undefined,
    // letting #6a/#6b distinguish "no members" from "fetch failed".
    for (const hid of houseIds) membersByHouse.set(hid, []);
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
      let session = sessionByHouse.get(houseId);

      for (const r of houseReservations) {
        const rName = names.get(r.requested_by) ?? 'A housemate';
        const timeStr = r.start_time ? ` at ${r.start_time}` : '';

        // ── #6a: Resolve pending reservations strictly in the past by vote tally ──
        if (r.status === 'pending' && r.date < today) {
          const castVotes = votesByReservation.get(r.id) ?? [];
          // Filter to eligible voters (current members minus requester) so the cron
          // tally matches the in-app tallyParkingReservationVotes logic.
          // If membersByHouse has no entry (member fetch errored), fall back to all
          // votes so the reservation still resolves rather than defaulting to rejected.
          const houseMembers = membersByHouse.get(r.house_id) ?? [];
          const eligibleVotes = !membersError
            ? castVotes.filter(
                (v) => v.user_id !== r.requested_by && houseMembers.includes(v.user_id)
              )
            : castVotes;
          const approveCount = eligibleVotes.filter((v) => v.vote === 'approve').length;
          const rejectCount = eligibleVotes.filter((v) => v.vote === 'reject').length;
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
              eligibleVotes.length === 0
                ? `Your request for ${r.date}${timeStr} expired — no votes were cast.`
                : approveCount === rejectCount
                  ? `Your request for ${r.date}${timeStr} expired — the vote was tied.`
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
            const houseMembers = membersByHouse.get(r.house_id) ?? [];
            const eligibleVotes = !membersError
              ? castVotes.filter(
                  (v) => v.user_id !== r.requested_by && houseMembers.includes(v.user_id)
                )
              : castVotes;
            const approveCount = eligibleVotes.filter((v) => v.vote === 'approve').length;
            const rejectCount = eligibleVotes.filter((v) => v.vote === 'reject').length;
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
                eligibleVotes.length === 0
                  ? `Your request for today${timeStr} expired — no votes were cast.`
                  : approveCount === rejectCount
                    ? `Your request for today${timeStr} expired — the vote was tied.`
                    : `Your request for today${timeStr} expired — majority voted no.`,
                { screen: 'parking' }
              );
            }
            continue;
          }
        }

        // ── #6d: Upcoming pending reservation whose votes already decide it ──────
        // Catches requests that are decided by the "half is enough" rule but were
        // never finalized (e.g. the voter's app closed before saving the status).
        if (r.status === 'pending' && r.date >= today && !membersError) {
          const houseMembers = membersByHouse.get(r.house_id) ?? [];
          const eligibleIds = houseMembers.filter((id) => id !== r.requested_by);
          const eligibleVotes = (votesByReservation.get(r.id) ?? []).filter((v) =>
            eligibleIds.includes(v.user_id)
          );
          const decided = earlyDecision(
            eligibleVotes.filter((v) => v.vote === 'approve').length,
            eligibleVotes.filter((v) => v.vote === 'reject').length,
            eligibleIds.length
          );
          if (decided) {
            const { data: resolved6d, error: resolveErr } = await supabase
              .from('parking_reservations')
              .update({ status: decided })
              .eq('id', r.id)
              .eq('status', 'pending')
              .select('id');
            if (resolveErr) {
              console.error(
                '[parking-check] early-resolve (#6d) failed for',
                r.id,
                resolveErr.message
              );
              continue;
            }
            if (!resolved6d?.length) continue; // already finalized elsewhere
            r.status = decided;
            await sendToUser(
              supabase,
              r.requested_by,
              r.house_id,
              decided === 'approved' ? '✅ Parking approved!' : '❌ Request denied',
              decided === 'approved'
                ? `Your request for ${r.date}${timeStr} was approved by the vote.`
                : `Your request for ${r.date}${timeStr} was voted down.`,
              { screen: 'parking' }
            );
            // An approved request for today continues into #4/#3 below so the
            // current occupant gets the "move your car" reminder this run.
            if (decided === 'rejected') continue;
          }
        }

        // ── #6c: Vote reminder for today's and tomorrow's pending reservations ──
        // Same-day requests are included so a request made for later today still
        // nudges the people who haven't voted (the instant push can be missed).
        // Skip entirely when membersError is set — without the member list we can't
        // notify non-voters, so we must not set pending_notice_sent either. The next
        // cron run will retry once the member fetch recovers.
        if (
          r.status === 'pending' &&
          (r.date === tomorrow || r.date === today) &&
          !r.pending_notice_sent &&
          !membersError
        ) {
          const isToday = r.date === today;
          const sentRequester = await sendToUser(
            supabase,
            r.requested_by,
            r.house_id,
            '⏳ Parking vote still open',
            isToday
              ? `Your parking request for today${timeStr} hasn't been decided yet — voting closes when it starts.`
              : `Your parking request for ${r.date}${timeStr} hasn't been decided yet — vote closes tomorrow.`,
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
              isToday
                ? `${rName} wants the spot today${timeStr} — vote before it starts or the majority decides.`
                : `${rName} wants the spot on ${r.date}${timeStr} — vote by tomorrow or the majority decides.`,
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

        // ── Approved reservations only from here — today, or tomorrow for the
        //    advance warning of an early-morning slot ──────────────────────────
        if (r.date !== today && r.date !== tomorrow) continue;

        const startMins = r.start_time ? toMinutes(r.start_time) : 0;
        const endMins = r.end_time ? toMinutes(r.end_time) : 24 * 60;
        const minsUntilStart =
          r.date === today ? startMins - nowMins : 24 * 60 - nowMins + startMins;

        // ── #4: ~2-hour advance warning to the current occupant ──────────────────
        // Checked on every run inside the window, so someone who parks after the
        // first check still gets warned. Marked done once the occupant got it.
        if (
          !r.advance_warning_sent &&
          session &&
          session.occupant !== r.requested_by &&
          minsUntilStart > 0 &&
          minsUntilStart <= ADVANCE_WARNING_MINUTES
        ) {
          const occupantName = names.get(session.occupant) ?? 'Someone';
          const startLabel = r.start_time ?? 'midnight';
          const sentOccupant4 = await sendToUser(
            supabase,
            session.occupant,
            r.house_id,
            '🚗 Spot needed soon',
            `${rName} has the spot from ${startLabel} — please free it up in time.`,
            { screen: 'parking' },
            'parking_claimed'
          );
          await sendToUser(
            supabase,
            r.requested_by,
            r.house_id,
            '⏰ Spot still in use',
            `${occupantName} is parked there now — we've asked them to free it before ${startLabel}.`,
            { screen: 'parking' },
            'parking_claimed'
          );
          if (sentOccupant4) updates.push({ id: r.id, patch: { advance_warning_sent: true } });
        }

        if (r.date !== today) continue;
        const slotRunning = nowMins >= startMins && nowMins < endMins;

        // ── #5: Slot running → the spot becomes the holder's ─────────────────────
        // Once per reservation: if the holder leaves early and frees the spot,
        // it is not grabbed back for them. A housemate still parked keeps the
        // spot (and gets #3) until they free it; the next run then claims it.
        if (slotRunning && !r.auto_claimed) {
          if (session?.occupant === r.requested_by) {
            r.auto_claimed = true;
            updates.push({ id: r.id, patch: { auto_claimed: true } });
          } else if (!session) {
            const { data: claimed, error: claimErr } = await supabase
              .from('parking_sessions')
              .insert({ house_id: r.house_id, occupant: r.requested_by, is_active: true })
              .select('id, house_id, occupant, is_active')
              .single();
            if (claimErr || !claimed) {
              // A unique-index clash means someone claimed it a moment ago — fine.
              console.warn('[parking-check] auto-claim (#5) skipped for', r.id, claimErr?.message);
            } else {
              session = claimed as Session;
              sessionByHouse.set(houseId, session);
              r.auto_claimed = true;
              updates.push({ id: r.id, patch: { auto_claimed: true } });
              const untilLabel = r.end_time ? ` until ${r.end_time}` : ' for the day';
              await sendToUser(
                supabase,
                r.requested_by,
                r.house_id,
                '🅿️ The spot is yours',
                `Your reserved slot has started — the parking spot is marked as yours${untilLabel}.`,
                { screen: 'parking' },
                'parking_claimed'
              );
            }
          }
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
