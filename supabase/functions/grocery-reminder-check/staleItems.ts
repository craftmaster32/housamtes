// "Still on the list?" nudges for grocery items waiting 72+ hours.
//
// Runs inside grocery-reminder-check (every 5 minutes), but sends at most one
// nudge per house per day, and only during daytime in the house's own timezone
// so nobody gets pinged at 3am. Each item is nudged once (stale_notified_at).
//
// Who hears about it:
//   • shared items  → every house member
//   • private items → only the person who added them
// Drafts are skipped (they expire after 24h) and ticked items are already bought.

import type { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { groceryStaleCopy, normalizeLang, type Lang } from '../_shared/notificationCopy.ts';
import { fetchPushDevices, sendPush, type PushDevice, type PushMessage } from '../_shared/push.ts';

type Supabase = ReturnType<typeof createClient>;

// Keep in sync with STALE_AFTER_HOURS in utils/groceryAge.ts (the app's amber label).
const STALE_AFTER_HOURS = 72;
// At most one nudge per house in this window.
const HOUSE_COOLDOWN_HOURS = 20;
// Local-time window (house timezone) in which nudges may go out: 10:00–19:59.
const SEND_FROM_HOUR = 10;
const SEND_UNTIL_HOUR = 20;
// At most this many items per house per run — so one house with a huge
// backlog (or nobody reachable) can never crowd out the others.
const PER_HOUSE_LIMIT = 20;
// Candidate rows read per page (stays under PostgREST's max_rows cap).
const CANDIDATE_PAGE = 1000;

const HOUR_MS = 60 * 60 * 1000;

interface StaleItemRow {
  id: string;
  house_id: string;
  name: string;
  added_by: string;
  is_personal: boolean;
}

export interface StaleCheckResult {
  sent: number;
  items: number;
}

/** Clears the "nudged" mark so a later run can try these items again. */
async function releaseClaims(supabase: Supabase, ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('grocery_items')
    .update({ stale_notified_at: null })
    .in('id', ids);
  if (error) console.error('Failed to release stale grocery claims', error.message);
}

/** Claims one house's stale items and pushes the nudge to whoever should hear it. */
async function nudgeHouse(
  supabase: Supabase,
  houseId: string,
  houseItems: StaleItemRow[],
  nowIso: string
): Promise<StaleCheckResult> {
  const none: StaleCheckResult = { sent: 0, items: 0 };

  // Load everything needed to send BEFORE claiming, so a lookup failure
  // leaves the items unclaimed and the next run simply tries again.
  const { data: memberRows, error: membersError } = await supabase
    .from('house_members')
    .select('user_id')
    .eq('house_id', houseId);
  if (membersError) return none;
  const memberIds = ((memberRows ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);

  let tokenRows: PushDevice[];
  try {
    tokenRows = await fetchPushDevices(supabase, { houseIds: [houseId], userIds: memberIds });
  } catch {
    return none;
  }

  // Fail closed: if preferences can't be loaded, nobody in this house is
  // pinged — someone who muted this must never get it anyway.
  const { data: prefRows, error: prefsError } = await supabase
    .from('notification_preferences')
    .select('user_id, notify_grocery_stale')
    .eq('house_id', houseId)
    .in('user_id', memberIds);
  if (prefsError) return none;
  const optedOut = new Set(
    ((prefRows ?? []) as Array<{ user_id: string; notify_grocery_stale: boolean | null }>)
      .filter((p) => p.notify_grocery_stale === false)
      .map((p) => p.user_id)
  );

  // Atomically claim the items so overlapping runs never double-nudge.
  const { data: claimedRows, error: claimError } = await supabase
    .from('grocery_items')
    .update({ stale_notified_at: nowIso })
    .in(
      'id',
      houseItems.map((i) => i.id)
    )
    .is('stale_notified_at', null)
    .select('id, house_id, name, added_by, is_personal');
  if (claimError) return none;
  const claimed = (claimedRows ?? []) as StaleItemRow[];
  // A house nobody lives in any more keeps the claim, so its items stop
  // coming back in every scan.
  if (claimed.length === 0 || memberIds.length === 0) return { sent: 0, items: claimed.length };

  // Which item names each member should hear about.
  const namesByUser = new Map<string, string[]>();
  for (const item of claimed) {
    const recipients = item.is_personal ? [item.added_by] : memberIds;
    for (const userId of recipients) {
      if (!memberIds.includes(userId) || optedOut.has(userId)) continue;
      const list = namesByUser.get(userId) ?? [];
      list.push(item.name);
      namesByUser.set(userId, list);
    }
  }

  const messages: PushMessage[] = [];
  for (const row of tokenRows) {
    const names = namesByUser.get(row.user_id);
    if (!names || names.length === 0) continue;
    const lang: Lang = normalizeLang(row.language);
    const copy = groceryStaleCopy(lang, { names });
    messages.push({
      to: row.token,
      title: copy.title,
      body: copy.body,
      sound: 'default',
      data: { screen: 'grocery' },
      web: row.web,
    });
  }

  const ids = claimed.map((i) => i.id);
  // Nobody reachable right now (no device registered, or everyone muted) —
  // release so a housemate who registers or unmutes later still gets it.
  if (messages.length === 0) {
    await releaseClaims(supabase, ids);
    return none;
  }

  if (await sendPush(supabase, messages)) return { sent: messages.length, items: claimed.length };

  // Release the claim so the next run retries instead of the nudge going missing.
  console.error('Stale grocery push failed after retries', houseId);
  await releaseClaims(supabase, ids);
  return none;
}

export async function runStaleItemCheck(
  supabase: Supabase,
  now: Date = new Date()
): Promise<StaleCheckResult> {
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - STALE_AFTER_HOURS * HOUR_MS).toISOString();
  const cooldownIso = new Date(now.getTime() - HOUSE_COOLDOWN_HOURS * HOUR_MS).toISOString();

  // One database query picks the candidates: daytime houses only, skipping
  // houses already nudged today, and at most PER_HOUSE_LIMIT items per house
  // (see grocery_stale_candidates in the migration). Read every page before
  // claiming anything, so our own writes can't shift the pages under us.
  const items: StaleItemRow[] = [];
  for (let from = 0; ; from += CANDIDATE_PAGE) {
    const { data, error } = await supabase
      .rpc('grocery_stale_candidates', {
        p_now: nowIso,
        p_cutoff: cutoffIso,
        p_cooldown_since: cooldownIso,
        p_from_hour: SEND_FROM_HOUR,
        p_until_hour: SEND_UNTIL_HOUR,
        p_per_house: PER_HOUSE_LIMIT,
      })
      .range(from, from + CANDIDATE_PAGE - 1);
    if (error) throw new Error(`Stale scan failed: ${error.message}`);
    const rows = (data ?? []) as StaleItemRow[];
    items.push(...rows);
    if (rows.length < CANDIDATE_PAGE) break;
  }

  const result: StaleCheckResult = { sent: 0, items: 0 };
  for (const houseId of new Set(items.map((it) => it.house_id))) {
    const r = await nudgeHouse(
      supabase,
      houseId,
      items.filter((it) => it.house_id === houseId),
      nowIso
    );
    result.sent += r.sent;
    result.items += r.items;
  }
  return result;
}
