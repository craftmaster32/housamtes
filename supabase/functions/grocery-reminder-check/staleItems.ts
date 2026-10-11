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
const SCAN_LIMIT = 500;

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

export async function runStaleItemCheck(
  supabase: Supabase,
  now: Date = new Date()
): Promise<StaleCheckResult> {
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - STALE_AFTER_HOURS * HOUR_MS).toISOString();

  const { data: candidates, error } = await supabase
    .from('grocery_items')
    .select('id, house_id, name, added_by, is_personal')
    .is('stale_notified_at', null)
    .eq('is_checked', false)
    .eq('is_draft', false)
    .lte('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .limit(SCAN_LIMIT);
  if (error) throw new Error(`Stale scan failed: ${error.message}`);
  const items = (candidates ?? []) as StaleItemRow[];
  if (items.length === 0) return { sent: 0, items: 0 };

  const houseIds = [...new Set(items.map((i) => i.house_id))];

  // Only houses where it's currently daytime.
  const { data: houseRows, error: housesError } = await supabase
    .from('houses')
    .select('id, timezone')
    .in('id', houseIds);
  if (housesError) throw new Error(`House lookup failed: ${housesError.message}`);
  const daytimeHouses = new Set(
    ((houseRows ?? []) as Array<{ id: string; timezone: string | null }>)
      .filter((h) => {
        const hour = localHour(h.timezone ?? 'UTC', now);
        return hour !== null && hour >= SEND_FROM_HOUR && hour < SEND_UNTIL_HOUR;
      })
      .map((h) => h.id)
  );
  if (daytimeHouses.size === 0) return { sent: 0, items: 0 };

  // Skip houses already nudged recently — their newly-stale items wait for
  // tomorrow's nudge, so a house never gets more than one a day.
  const cooldownIso = new Date(now.getTime() - HOUSE_COOLDOWN_HOURS * HOUR_MS).toISOString();
  const { data: recentRows, error: recentError } = await supabase
    .from('grocery_items')
    .select('house_id')
    .in('house_id', [...daytimeHouses])
    .gte('stale_notified_at', cooldownIso);
  if (recentError) throw new Error(`Cooldown lookup failed: ${recentError.message}`);
  for (const r of (recentRows ?? []) as Array<{ house_id: string }>) {
    daytimeHouses.delete(r.house_id);
  }

  let sent = 0;
  let nudged = 0;

  for (const houseId of daytimeHouses) {
    const houseItems = items.filter((i) => i.house_id === houseId);
    if (houseItems.length === 0) continue;

    // Load everything needed to send BEFORE claiming, so a lookup failure
    // leaves the items unclaimed and the next run simply tries again.
    const { data: memberRows, error: membersError } = await supabase
      .from('house_members')
      .select('user_id')
      .eq('house_id', houseId);
    if (membersError) continue;
    const memberIds = ((memberRows ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
    if (memberIds.length === 0) continue;

    const { data: tokenRows, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token, user_id, language')
      .eq('house_id', houseId)
      .in('user_id', memberIds);
    if (tokensError) continue;

    // Fail closed: if preferences can't be loaded, nobody in this house is
    // pinged — someone who muted this must never get it anyway.
    const { data: prefRows, error: prefsError } = await supabase
      .from('notification_preferences')
      .select('user_id, notify_grocery_stale')
      .eq('house_id', houseId)
      .in('user_id', memberIds);
    if (prefsError) continue;
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
    if (claimError) continue;
    const claimed = (claimedRows ?? []) as StaleItemRow[];
    if (claimed.length === 0) continue;
    nudged += claimed.length;

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
    if (messages.length === 0) continue;

    if (await sendPushWithRetry(messages)) {
      sent += messages.length;
    } else {
      // Release the claim so the next run retries instead of the nudge going missing.
      console.error('Stale grocery push failed after retries', houseId);
      const { error: releaseError } = await supabase
        .from('grocery_items')
        .update({ stale_notified_at: null })
        .in(
          'id',
          claimed.map((i) => i.id)
        );
      if (releaseError) {
        console.error('Failed to release stale grocery claims', releaseError.message);
      }
    }
  }

  return { sent, items: nudged };
}
