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

type Supabase = ReturnType<typeof createClient>;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const PUSH_TIMEOUT_MS = 5000;
const PUSH_MAX_ATTEMPTS = 3;

// Keep in sync with STALE_AFTER_HOURS in utils/groceryAge.ts (the app's amber label).
const STALE_AFTER_HOURS = 72;
// At most one nudge per house in this window.
const HOUSE_COOLDOWN_HOURS = 20;
// Local-time window (house timezone) in which nudges may go out: 10:00–19:59.
const SEND_FROM_HOUR = 10;
const SEND_UNTIL_HOUR = 20;
// Items fetched per batch of houses.
const SCAN_LIMIT = 500;
// Houses read per page, and house ids per `.in(...)` filter (keeps URLs short).
const HOUSE_PAGE = 1000;
const HOUSE_CHUNK = 100;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPushWithRetry(messages: unknown[]): Promise<boolean> {
  for (let attempt = 1; attempt <= PUSH_MAX_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (resp.ok) return true;
    } catch {
      // fall through to retry
    }
    if (attempt < PUSH_MAX_ATTEMPTS) await sleep(2 ** (attempt - 1) * 500);
  }
  return false;
}

/** Current hour (0–23) in the given timezone, or null if the timezone is invalid. */
export function localHour(tz: string, now: Date): number | null {
  try {
    const hour = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(now);
    const n = parseInt(hour, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Ids of every house where it is currently daytime (bad timezones fall back to UTC). */
async function loadDaytimeHouseIds(supabase: Supabase, now: Date): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ; from += HOUSE_PAGE) {
    const { data, error } = await supabase
      .from('houses')
      .select('id, timezone')
      .order('id', { ascending: true })
      .range(from, from + HOUSE_PAGE - 1);
    if (error) throw new Error(`House lookup failed: ${error.message}`);
    const rows = (data ?? []) as Array<{ id: string; timezone: string | null }>;
    for (const h of rows) {
      const hour = localHour(h.timezone ?? 'UTC', now) ?? localHour('UTC', now);
      if (hour !== null && hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR) ids.push(h.id);
    }
    if (rows.length < HOUSE_PAGE) return ids;
  }
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

  const { data: tokenRows, error: tokensError } = await supabase
    .from('push_tokens')
    .select('token, user_id, language')
    .eq('house_id', houseId)
    .in('user_id', memberIds);
  if (tokensError) return none;

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

  const messages: Array<Record<string, unknown>> = [];
  for (const row of (tokenRows ?? []) as Array<{
    token: string;
    user_id: string;
    language?: string;
  }>) {
    const names = namesByUser.get(row.user_id);
    if (!row.token || !names || names.length === 0) continue;
    const lang: Lang = normalizeLang(row.language);
    const copy = groceryStaleCopy(lang, { names });
    messages.push({
      to: row.token,
      title: copy.title,
      body: copy.body,
      sound: 'default',
      data: { screen: 'grocery' },
    });
  }

  const ids = claimed.map((i) => i.id);
  // Nobody reachable right now (no device registered, or everyone muted) —
  // release so a housemate who registers or unmutes later still gets it.
  if (messages.length === 0) {
    await releaseClaims(supabase, ids);
    return none;
  }

  if (await sendPushWithRetry(messages)) return { sent: messages.length, items: claimed.length };

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

  // Pick eligible houses FIRST (daytime, not nudged recently) and only then
  // look for their items — so items in night-time or cooling-down houses can
  // never fill the scan and starve everyone else.
  const daytime = await loadDaytimeHouseIds(supabase, now);
  const result: StaleCheckResult = { sent: 0, items: 0 };

  for (let i = 0; i < daytime.length; i += HOUSE_CHUNK) {
    const chunk = daytime.slice(i, i + HOUSE_CHUNK);

    // Skip houses already nudged recently — their newly-stale items wait for
    // tomorrow's nudge, so a house never gets more than one a day.
    const { data: recentRows, error: recentError } = await supabase
      .from('grocery_items')
      .select('house_id')
      .in('house_id', chunk)
      .gte('stale_notified_at', cooldownIso);
    if (recentError) throw new Error(`Cooldown lookup failed: ${recentError.message}`);
    const cooling = new Set(
      ((recentRows ?? []) as Array<{ house_id: string }>).map((r) => r.house_id)
    );
    const eligible = chunk.filter((id) => !cooling.has(id));
    if (eligible.length === 0) continue;

    const { data: candidates, error } = await supabase
      .from('grocery_items')
      .select('id, house_id, name, added_by, is_personal')
      .in('house_id', eligible)
      .is('stale_notified_at', null)
      .eq('is_checked', false)
      .eq('is_draft', false)
      .lte('created_at', cutoffIso)
      .order('created_at', { ascending: true })
      .limit(SCAN_LIMIT);
    if (error) throw new Error(`Stale scan failed: ${error.message}`);
    const items = (candidates ?? []) as StaleItemRow[];

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
  }

  return result;
}
