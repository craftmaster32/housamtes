// One-time "turn on notifications" prompt flag, stored on the device.
//
// On the web app a browser will only show its notification permission popup
// in response to a real tap — so we can't turn notifications on automatically
// at signup. Instead we show a friendly in-app card once, with a button that
// makes that tap for the user. This flag remembers that we've already asked on
// this device, so people aren't nagged on every launch: once they either turn
// notifications on or tap "Maybe later", we don't ask again (they can always
// enable it later from Settings → Notifications).

import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_PROMPT_KEY = 'nestiq_notif_permission_prompt';

export async function hasSeenNotifPrompt(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(NOTIF_PROMPT_KEY)) === 'done';
  } catch {
    // If storage is unreadable, err on the side of not nagging.
    return true;
  }
}

export async function markNotifPromptSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_PROMPT_KEY, 'done');
  } catch {
    // Non-fatal — worst case the card shows once more next launch.
  }
}

// The notification-permission states the card cares about, unified across web
// (getWebPushStatus) and native (getNativeNotificationStatus).
export type NotifPermissionStatus =
  | 'granted'
  | 'denied'
  | 'default' // web: can still ask
  | 'undetermined' // native: can still ask
  | 'unavailable' // not supported in THIS context (e.g. iOS Safari tab before "Add to Home Screen")
  | 'unsupported';

export type NotifPromptDecision = 'show' | 'hide' | 'hide-and-remember';

/**
 * Decide what the one-time notification card should do for a given permission
 * state. Pure so it can be unit-tested without mocking the platform.
 *
 * The important subtlety: we only *remember* ("don't ask again on this device")
 * when there's a real, stable answer — the user already granted it, or the OS/
 * browser denied it. When notifications are merely `unavailable`/`unsupported`
 * in the current context — most importantly an iOS website opened in a Safari
 * tab, where Apple exposes no notification capability until the app is added to
 * the Home Screen — we hide the card WITHOUT remembering, so the user is still
 * offered the prompt once they open the app somewhere it can actually ask.
 */
export function decideNotifPrompt(status: NotifPermissionStatus): NotifPromptDecision {
  if (status === 'default' || status === 'undetermined') return 'show';
  if (status === 'granted' || status === 'denied') return 'hide-and-remember';
  return 'hide';
}
