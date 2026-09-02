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
