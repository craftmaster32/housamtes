// New-user welcome tour — a one-time flag stored on the device.
//
// The flag is set to 'pending' the moment a brand-new account is created
// (in the signup screen), read once the user lands on the dashboard, and
// then flipped to 'done'. Gating on the explicit 'pending' value means the
// tour only ever shows to people who just signed up — existing housemates
// logging back in on a fresh device never see it.

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOUR_KEY = 'housemates_new_user_tour';

// "New look" note for people who used the app before the 3.0 redesign. It
// shows once per device; brand-new accounts skip it (they never saw the old
// look and get the tour instead).
const WHATS_NEW_KEY = 'housemates_whats_new_seen';
export const WHATS_NEW_VERSION = '3.0.0';

export async function markTourPending(): Promise<void> {
  try {
    await AsyncStorage.setItem(TOUR_KEY, 'pending');
    await AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION);
  } catch {
    // Non-fatal — a missed tour is not worth surfacing an error to the user.
  }
}

export async function shouldShowWhatsNew(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(WHATS_NEW_KEY)) !== WHATS_NEW_VERSION;
  } catch {
    return false;
  }
}

export async function markWhatsNewSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION);
  } catch {
    // Non-fatal — the worst case is the note shows once more next launch.
  }
}

export async function shouldShowTour(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(TOUR_KEY);
    return value === 'pending';
  } catch {
    return false;
  }
}

export async function markTourSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(TOUR_KEY, 'done');
  } catch {
    // Non-fatal — the worst case is the tour shows once more next launch.
  }
}
