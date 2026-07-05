import { Platform } from 'react-native';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';

export type WebPushStatus = 'granted' | 'denied' | 'default' | 'unavailable';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isWebPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

async function subscribeAndSave(userId: string, houseId: string): Promise<void> {
  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return;

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let existingSub = await registration.pushManager.getSubscription();

  // Safari (and occasionally Chrome) can silently invalidate a subscription — the push
  // service starts returning 410, send-push deletes the row, but PushManager keeps
  // handing us back the same stale subscription object. If the DB row for this
  // (user, house) is missing or points at a different endpoint, treat the local
  // subscription as dead: unsubscribe and create a fresh one so a new endpoint gets saved.
  if (existingSub) {
    const { data: row, error: readError } = await supabase
      .from('web_push_subscriptions')
      .select('endpoint')
      .eq('user_id', userId)
      .eq('house_id', houseId)
      .maybeSingle();
    // Only reconcile when the read actually succeeded — on a network / auth blip,
    // reuse the local sub rather than churning it based on a phantom "missing row".
    if (!readError && (!row || row.endpoint !== existingSub.endpoint)) {
      await existingSub.unsubscribe();
      existingSub = null;
    }
  }

  const subscription =
    existingSub ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
    }));

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) return;

  await supabase.from('web_push_subscriptions').upsert(
    {
      user_id: userId,
      house_id: houseId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,house_id' }
  );
}

/** Called on startup — re-subscribes silently if already granted. Never asks for permission. */
export async function registerWebPush(userId: string, houseId: string): Promise<void> {
  if (!isWebPushSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    await subscribeAndSave(userId, houseId);
  } catch (err) {
    captureError(err, { context: 'registerWebPush' });
  }
}

/** Called from a user tap — asks for permission then subscribes. Must be triggered by a gesture. */
export async function enableWebPush(userId: string, houseId: string): Promise<WebPushStatus> {
  if (!isWebPushSupported()) return 'unavailable';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission as WebPushStatus;
    await subscribeAndSave(userId, houseId);
    return 'granted';
  } catch (err) {
    captureError(err, { context: 'enableWebPush' });
    return 'unavailable';
  }
}

export interface RefreshWebPushResult {
  ok: boolean;
  reason:
    | 'saved'
    | 'unsupported'
    | 'blocked'
    | 'default'
    | 'vapid-missing'
    | 'no-keys'
    | 'db-error'
    | 'exception';
  message?: string;
}

/**
 * Force a fresh subscription, bypassing the "reuse existing sub" path.
 * Called from a user tap when the "On" state is stuck and the DB row is missing.
 * Must be triggered by a gesture on Safari.
 */
export async function refreshWebPush(
  userId: string,
  houseId: string
): Promise<RefreshWebPushResult> {
  if (!isWebPushSupported()) {
    return { ok: false, reason: 'unsupported', message: 'Web push not supported here' };
  }
  try {
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission === 'denied') return { ok: false, reason: 'blocked' };
      if (permission !== 'granted') return { ok: false, reason: 'default' };
    }

    const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return {
        ok: false,
        reason: 'vapid-missing',
        message: 'EXPO_PUBLIC_VAPID_PUBLIC_KEY not set in build',
      };
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Always drop the local sub first so PushManager mints a fresh endpoint.
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
    });

    const json = subscription.toJSON();
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!p256dh || !auth) return { ok: false, reason: 'no-keys' };

    const { error: dbError } = await supabase.from('web_push_subscriptions').upsert(
      {
        user_id: userId,
        house_id: houseId,
        endpoint: subscription.endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,house_id' }
    );
    if (dbError) return { ok: false, reason: 'db-error', message: dbError.message };

    return { ok: true, reason: 'saved' };
  } catch (err) {
    captureError(err, { context: 'refreshWebPush' });
    return {
      ok: false,
      reason: 'exception',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function getWebPushStatus(): WebPushStatus {
  if (!isWebPushSupported()) return 'unavailable';
  return Notification.permission as WebPushStatus;
}

export async function unregisterWebPush(userId: string, houseId: string): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  try {
    await supabase
      .from('web_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('house_id', houseId);
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await registration?.pushManager.getSubscription();
      await sub?.unsubscribe();
    }
  } catch (err) {
    captureError(err, { context: 'unregisterWebPush' });
  }
}
