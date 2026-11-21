import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@lib/supabase';
import {
  markTourPending,
  shouldShowTour,
  markTourSeen,
  shouldShowWhatsNew,
  markWhatsNewSeen,
  WHATS_NEW_META_KEY,
  WHATS_NEW_VERSION,
} from '@utils/tour';

jest.mock('@lib/supabase', () => ({
  supabase: { auth: { updateUser: jest.fn(), getUser: jest.fn() } },
}));

const TOUR_KEY = 'housemates_new_user_tour';
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const OLD_ACCOUNT = { id: 'user-1', createdAt: '2025-03-01T10:00:00Z', metadata: {} };
const NEW_ACCOUNT = { id: 'user-2', createdAt: '2026-11-01T10:00:00Z', metadata: {} };
// Per-account device key for user-1
const USER1_DEVICE_KEY = 'housemates_whats_new_seen_user-1';

describe('new-user welcome tour flag', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('does not show the tour by default (existing users)', async () => {
    expect(await shouldShowTour()).toBe(false);
  });

  it('shows the tour after a new account queues it', async () => {
    await markTourPending();
    expect(await AsyncStorage.getItem(TOUR_KEY)).toBe('pending');
    expect(await shouldShowTour()).toBe(true);
  });

  it('stops showing the tour once it has been seen', async () => {
    await markTourPending();
    await markTourSeen();
    expect(await AsyncStorage.getItem(TOUR_KEY)).toBe('done');
    expect(await shouldShowTour()).toBe(false);
  });

  it('never shows again on a second launch after being seen', async () => {
    await markTourPending();
    await markTourSeen();
    expect(await shouldShowTour()).toBe(false);
    // A returning user logging in should still not trigger it.
    expect(await shouldShowTour()).toBe(false);
  });
});

describe('"new look" note for the 3.0 redesign', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('shows once to people who used the app before', async () => {
    expect(await shouldShowWhatsNew(OLD_ACCOUNT)).toBe(true);
    await markWhatsNewSeen('user-1');
    expect(await shouldShowWhatsNew(OLD_ACCOUNT)).toBe(false);
  });

  it('saves "seen" on the account, not only the device', async () => {
    await markWhatsNewSeen('user-1');
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { [WHATS_NEW_META_KEY]: WHATS_NEW_VERSION },
    });
  });

  it('does not show again after signing in on a fresh device', async () => {
    const seen = { ...OLD_ACCOUNT, metadata: { [WHATS_NEW_META_KEY]: WHATS_NEW_VERSION } };
    expect(await shouldShowWhatsNew(seen)).toBe(false);
  });

  it('never shows to accounts created after 3.0 shipped', async () => {
    expect(await shouldShowWhatsNew(NEW_ACCOUNT)).toBe(false);
  });

  it('is skipped for brand-new accounts, who get the tour instead', async () => {
    // Brand-new accounts are created after WHATS_NEW_RELEASED_AT so the date
    // check suppresses the note regardless of any device flag.
    expect(await shouldShowWhatsNew(NEW_ACCOUNT)).toBe(false);
  });

  it('copies a device-only "seen" onto the account', async () => {
    await AsyncStorage.setItem(USER1_DEVICE_KEY, WHATS_NEW_VERSION);
    expect(await shouldShowWhatsNew(OLD_ACCOUNT)).toBe(false);
    expect(mockUpdateUser).toHaveBeenCalled();
  });

  it('stays hidden while nobody is signed in', async () => {
    expect(await shouldShowWhatsNew(null)).toBe(false);
  });

  it('does not mark another account as seen by the first account flag', async () => {
    await markWhatsNewSeen('user-1');
    const otherAccount = { id: 'user-2', createdAt: '2025-03-01T10:00:00Z', metadata: {} };
    expect(await shouldShowWhatsNew(otherAccount)).toBe(true);
  });

  it('stays hidden for someone who dismissed it before this update', async () => {
    await AsyncStorage.setItem('housemates_whats_new_seen', WHATS_NEW_VERSION);
    expect(await shouldShowWhatsNew({ ...OLD_ACCOUNT, id: 'u1' })).toBe(false);
  });
});
