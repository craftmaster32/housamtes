// Shared push delivery for the scheduled (server-side) Edge Functions.
//
// A housemate can be reachable in two ways:
//   • the native app  → an Expo push token in `push_tokens`
//   • the web app     → a browser subscription in `web_push_subscriptions`
// fetchPushDevices returns both as one list, so the reminder functions pick
// recipients exactly as before, and sendPush routes each message to the right
// service. Without this, web-app users never got any scheduled reminder.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Any client works here — these helpers only touch two tables by name.
// deno-lint-ignore no-explicit-any
type Supabase = SupabaseClient<any, any, any>;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100; // Expo accepts at most 100 messages per request
const PUSH_TIMEOUT_MS = 5000;
const RETRY_DELAYS_MS = [500, 1000]; // 3 attempts in total

/** Keys a browser subscription needs; present only on web devices. */
export interface WebKeys {
  p256dh: string;
  auth: string;
}

/** One place a notification can be delivered to. */
export interface PushDevice {
  /** Expo push token, or the browser subscription endpoint for web devices. */
  token: string;
  user_id: string;
  house_id: string;
  language: string | null;
  web?: WebKeys;
}

/** An Expo-shaped message; set `web` (from the device) for web devices. */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
  priority?: string;
  web?: WebKeys;
}

interface DeviceFilter {
  houseIds?: string[];
  userIds?: string[];
}

/**
 * Loads every native and web device matching the filter. Throws when either
 * lookup fails so callers can keep their existing fail-closed handling.
 */
export async function fetchPushDevices(
  supabase: Supabase,
  filter: DeviceFilter = {}
): Promise<PushDevice[]> {
  let tokenQuery = supabase.from('push_tokens').select('token, user_id, house_id, language');
  let webQuery = supabase
    .from('web_push_subscriptions')
    .select('endpoint, p256dh, auth, user_id, house_id, language');
  if (filter.houseIds) {
    tokenQuery = tokenQuery.in('house_id', filter.houseIds);
    webQuery = webQuery.in('house_id', filter.houseIds);
  }
  if (filter.userIds) {
    tokenQuery = tokenQuery.in('user_id', filter.userIds);
    webQuery = webQuery.in('user_id', filter.userIds);
  }

  const [tokenRes, webRes] = await Promise.all([tokenQuery, webQuery]);
  if (tokenRes.error) throw new Error(`push_tokens lookup failed: ${tokenRes.error.message}`);
  if (webRes.error) {
    console.warn(`[push] web_push_subscriptions lookup failed, skipping web devices: ${webRes.error.message}`);
  }

  const devices: PushDevice[] = [];
  for (const r of (tokenRes.data ?? []) as Array<{
    token: string;
    user_id: string;
    house_id: string;
    language: string | null;
  }>) {
    if (r.token) devices.push(r);
  }
  for (const r of (webRes.data ?? []) as Array<{
    endpoint: string;
    p256dh: string;
    auth: string;
    user_id: string;
    house_id: string;
    language: string | null;
  }>) {
    if (!r.endpoint) continue;
    devices.push({
      token: r.endpoint,
      user_id: r.user_id,
      house_id: r.house_id,
      language: r.language,
      web: { p256dh: r.p256dh, auth: r.auth },
    });
  }
  return devices;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postExpoBatch(batch: PushMessage[]): Promise<boolean> {
  const body = JSON.stringify(batch.map(({ web: _web, ...m }) => m));
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (res.ok) return true;
      console.warn(`[push] Expo attempt ${attempt + 1} returned ${res.status}`);
    } catch (err) {
      console.warn(`[push] Expo attempt ${attempt + 1} threw:`, err);
    }
    if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
  }
  return false;
}

interface WebPushLib {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    sub: { endpoint: string; keys: WebKeys },
    payload: string,
    options?: { timeout?: number }
  ) => Promise<unknown>;
}

// web-push is loaded only when there is a web message to send, so the
// Expo-only paths (and the Jest tests that load these modules) never need it.
let webpushLib: WebPushLib | null | undefined;
async function loadWebPush(): Promise<WebPushLib | null> {
  if (webpushLib !== undefined) return webpushLib;
  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  const contact = Deno.env.get('VAPID_CONTACT_EMAIL');
  if (!pub || !priv || !contact) {
    console.warn('[push] VAPID keys not configured — skipping web push');
    webpushLib = null;
    return null;
  }
  try {
    const lib = ((await import('npm:web-push@3.6.7')) as { default: WebPushLib }).default;
    lib.setVapidDetails(`mailto:${contact}`, pub, priv);
    webpushLib = lib;
    return lib;
  } catch (err) {
    console.error('[push] web-push init failed — skipping web push', err);
    webpushLib = null;
    return null;
  }
}

async function sendWeb(supabase: Supabase, messages: PushMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  const webpush = await loadWebPush();
  if (!webpush) return 0;
  const results = await Promise.allSettled(
    messages.map((m) =>
      webpush.sendNotification(
        { endpoint: m.to, keys: m.web as WebKeys },
        JSON.stringify({ title: m.title, body: m.body, data: m.data ?? {} }),
        { timeout: PUSH_TIMEOUT_MS }
      )
    )
  );

  // HTTP 404/410 = the browser dropped this subscription — clean it up.
  const expired = messages
    .filter((_, i) => {
      const r = results[i];
      const code = r.status === 'rejected' && (r.reason as { statusCode?: number })?.statusCode;
      return code === 404 || code === 410;
    })
    .map((m) => m.to);
  if (expired.length > 0) {
    await supabase.from('web_push_subscriptions').delete().in('endpoint', expired);
  }
  return results.filter((r) => r.status === 'fulfilled').length;
}

/**
 * Sends each message through Expo (native) or Web Push (browser). Returns
 * true when at least one message was delivered — callers use this to decide
 * whether to retry later, and a partial success must not re-notify the people
 * who already got it.
 */
export async function sendPush(supabase: Supabase, messages: PushMessage[]): Promise<boolean> {
  if (messages.length === 0) return false;
  const expo = messages.filter((m) => !m.web);
  const web = messages.filter((m) => m.web);

  let delivered = false;
  for (let i = 0; i < expo.length; i += EXPO_BATCH_SIZE) {
    if (await postExpoBatch(expo.slice(i, i + EXPO_BATCH_SIZE))) delivered = true;
  }
  if (expo.length > 0 && !delivered) console.error('[push] Expo push failed after retries');

  if ((await sendWeb(supabase, web)) > 0) delivered = true;
  return delivered;
}
