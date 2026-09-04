// HouseMates — web push (browser / installed PWA) delivery helper.
//
// The scheduled reminder functions (event-reminder, bill-due-reminder,
// chore-due-reminder) originally sent only to Expo native tokens, so members
// who use the installed web app got no reminders at all. This helper mirrors
// the web-push path that send-push already uses, so those cron jobs can deliver
// to web subscribers too. It sets urgency 'high' + a TTL for the same reason
// the service worker sets its heads-up options: to make Android show the
// notification promptly rather than dropping it silently.

import webpush from 'npm:web-push';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { selectExpiredEndpoints } from './webPushCore.ts';

export interface WebPushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
  language: string | null;
}

// setVapidDetails mutates module-global state in web-push; do it once per run.
let vapidConfigured = false;

/** VAPID credentials, or null when the deployment hasn't configured them. */
function getVapid(): { publicKey: string; privateKey: string; contact: string } | null {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const contact = Deno.env.get('VAPID_CONTACT_EMAIL');
  if (!publicKey || !privateKey || !contact) return null;
  return { publicKey, privateKey, contact };
}

/** Fetch a house's web push subscriptions for the given users. */
export async function fetchWebSubs(
  supabase: SupabaseClient,
  houseId: string,
  userIds: string[]
): Promise<WebPushSub[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('web_push_subscriptions')
    .select('endpoint, p256dh, auth, user_id, language')
    .eq('house_id', houseId)
    .in('user_id', userIds);
  if (error) {
    console.error('[webPush] subscription lookup failed:', error.message);
    return [];
  }
  return (data ?? []) as WebPushSub[];
}

/**
 * Send one notification to each subscription. `buildCopy` is called per
 * subscription with that device's saved language so the text is localized the
 * same way the native path is. Dead subscriptions (HTTP 410) are pruned.
 * Returns the number of sends the push service accepted.
 */
export async function sendWebPush(
  supabase: SupabaseClient,
  subs: WebPushSub[],
  buildCopy: (language: string | null) => { title: string; body: string },
  data: Record<string, string>
): Promise<number> {
  if (subs.length === 0) return 0;
  const vapid = getVapid();
  if (!vapid) return 0;

  if (!vapidConfigured) {
    webpush.setVapidDetails(`mailto:${vapid.contact}`, vapid.publicKey, vapid.privateKey);
    vapidConfigured = true;
  }

  const results = await Promise.allSettled(
    subs.map((sub) => {
      const copy = buildCopy(sub.language);
      const payload = JSON.stringify({ title: copy.title, body: copy.body, data });
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { urgency: 'high', TTL: 86400 }
      );
    })
  );

  const expired = selectExpiredEndpoints(results, subs);
  if (expired.length > 0) {
    await supabase.from('web_push_subscriptions').delete().in('endpoint', expired);
  }

  return results.filter((r) => r.status === 'fulfilled').length;
}
