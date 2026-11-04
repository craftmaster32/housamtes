// New-user welcome tour — a one-time flag stored on the device.
//
// The flag is set to 'pending' the moment a brand-new account is created
// (in the signup screen), read once the user lands on the dashboard, and
// then flipped to 'done'. Gating on the explicit 'pending' value means the
// tour only ever shows to people who just signed up — existing housemates
// logging back in on a fresh device never see it.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@lib/supabase';

const TOUR_KEY = 'housemates_new_user_tour';

// "New look" note for people who used the app before the 3.0 redesign. It
// shows once per ACCOUNT: "seen" is saved on the account (Supabase user
// metadata) as well as the device, so signing in again, on a new phone or on
// the web never brings it back. Accounts created after 3.0 shipped never saw
// the old look, so they never get it.
const WHATS_NEW_KEY = 'housemates_whats_new_seen';
export const WHATS_NEW_VERSION = '3.0.0';
export const WHATS_NEW_META_KEY = 'whats_new_seen';
// When 3.0 went live — accounts made on/after this only know the new design.
export const WHATS_NEW_RELEASED_AT = '2026-10-27T00:00:00Z';

/** What we know about the signed-in account when deciding on the note. */
export interface WhatsNewAccount {
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export async function markTourPending(): Promise<void> {
  try {
    await AsyncStorage.setItem(TOUR_KEY, 'pending');
    await AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION);
  } catch {
    // Non-fatal — a missed tour is not worth surfacing an error to the user.
  }
}

export async function shouldShowWhatsNew(account: WhatsNewAccount | null): Promise<boolean> {
  // No account yet — wait; never guess and pop it up for the wrong person.
  if (!account) return false;
  // New-design-only accounts never used the old version.
  if (!account.createdAt || account.createdAt >= WHATS_NEW_RELEASED_AT) return false;
  // Already dismissed on any device signed in to this account.
  if (account.metadata?.[WHATS_NEW_META_KEY] === WHATS_NEW_VERSION) return false;
  try {
    if ((await AsyncStorage.getItem(WHATS_NEW_KEY)) === WHATS_NEW_VERSION) {
      // Seen on this device before the account remembered it — copy it over.
      await saveSeenOnAccount();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function saveSeenOnAccount(): Promise<void> {
  try {
    await supabase.auth.updateUser({ data: { [WHATS_NEW_META_KEY]: WHATS_NEW_VERSION } });
  } catch {
    // Non-fatal — the device flag still stops it here; we retry next visit.
  }
}

export async function markWhatsNewSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION);
  } catch {
    // Non-fatal — the account flag below still remembers it.
  }
  await saveSeenOnAccount();
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
