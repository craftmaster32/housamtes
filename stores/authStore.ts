import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@lib/supabase';
import { identifyUser, clearUser, captureError } from '@lib/errorTracking';
import { registerPushToken, unregisterPushToken } from '@lib/notifications';
import { registerWebPush, unregisterWebPush } from '@lib/webPush';
import type { User, Session } from '@supabase/supabase-js';

const PENDING_EMAIL_KEY = 'housemates_pending_email_v1';
const CURRENT_TERMS_VERSION = '2026-05-10';

async function savePendingEmail(email: string): Promise<void> {
  try { await AsyncStorage.setItem(PENDING_EMAIL_KEY, email); } catch { /* non-fatal */ }
}

async function loadPendingEmail(): Promise<string | null> {
  try { return await AsyncStorage.getItem(PENDING_EMAIL_KEY); } catch { return null; }
}

async function clearPendingEmail(): Promise<void> {
  try { await AsyncStorage.removeItem(PENDING_EMAIL_KEY); } catch { /* non-fatal */ }
}

// ── Persistent house cache ────────────────────────────────────────────────────
// Stores houseId keyed by userId so the app never forgets which house
// a user belongs to, even across refreshes or platform switches.
// Mobile: expo-secure-store (iOS Keychain / Android Keystore — survives reinstalls
//         and is never cleared by the OS under memory pressure).
// Web:    localStorage (best available, cleared only on explicit user action).
const HOUSE_CACHE_PREFIX = 'housemates_house_v1_';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSecureStore(): any {
  // expo-secure-store is native-only — never import it at the top level
  // or the web build will crash. Lazy require is safe because this code
  // path is only reached when Platform.OS !== 'web'.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-secure-store');
}

async function cacheHouseId(userId: string, houseId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HOUSE_CACHE_PREFIX + userId, houseId);
      }
    } else {
      await getSecureStore().setItemAsync(HOUSE_CACHE_PREFIX + userId, houseId);
    }
  } catch { /* non-fatal */ }
}

async function getCachedHouseId(userId: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(HOUSE_CACHE_PREFIX + userId);
      }
      return null;
    }
    return await getSecureStore().getItemAsync(HOUSE_CACHE_PREFIX + userId);
  } catch { return null; }
}

async function clearCachedHouseId(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(HOUSE_CACHE_PREFIX + userId);
      }
    } else {
      await getSecureStore().deleteItemAsync(HOUSE_CACHE_PREFIX + userId);
    }
  } catch { /* non-fatal */ }
}

// Map raw Supabase error messages to user-friendly text so internal
// server details are never shown on screen.
function sanitizeAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
    return 'Incorrect email or password';
  }
  if (msg.includes('email not confirmed')) return 'Please verify your email before signing in';
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'An account with this email already exists';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again';
  }
  if (msg.includes('network') || msg.includes('fetch failed')) {
    return 'Connection error. Check your internet and try again';
  }
  if (msg.includes('weak password') || msg.includes('password')) {
    return 'Password does not meet requirements';
  }
  return 'Something went wrong. Please try again';
}

export interface MemberPermissions {
  bills: boolean;
  grocery: boolean;
  parking: boolean;
  chores: boolean;
  chat: boolean;
  photos: boolean;
  voting: boolean;
  maintenance: boolean;
  condition: boolean;
}

export type MemberRole = 'owner' | 'admin' | 'member';

export const DEFAULT_PERMISSIONS: MemberPermissions = {
  bills: true, grocery: true, parking: true, chores: true,
  chat: true, photos: true, voting: true, maintenance: true, condition: true,
};

export interface Profile {
  id: string;
  name: string;
  avatarColor: string;
  avatarUrl?: string;
  coverUrl?: string;
}

interface AuthStore {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  houseId: string | null;
  role: MemberRole | null;
  permissions: MemberPermissions;
  isLoading: boolean;
  error: string | null;
  pendingEmail: string | null;

  isPasswordRecovery: boolean;
  needsTermsAcceptance: boolean;
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, name: string, avatarColor: string) => Promise<{ needsVerification: boolean }>;
  resendVerification: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  uploadAvatar: (uri: string, mimeType?: string, base64?: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
  uploadCover: (uri: string, mimeType?: string, base64?: string) => Promise<void>;
  removeCover: () => Promise<void>;
  setHouseId: (houseId: string) => void;
  reloadMembership: () => Promise<void>;
  leaveHouse: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  acceptUpdatedTerms: () => Promise<void>;
  clearError: () => void;
  clearPasswordRecovery: () => void;
}

let _appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      user: null,
      session: null,
      profile: null,
      houseId: null,
      role: null,
      permissions: DEFAULT_PERMISSIONS,
      isLoading: true,
      error: null,
      pendingEmail: null,
      isPasswordRecovery: false,
      needsTermsAcceptance: false,

      initialize: async (): Promise<void> => {
        // Remove any previously attached AppState listener before re-attaching
        // (guards against double-init on Fast Refresh or double render)
        _appStateSub?.remove();
        _appStateSub = AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            supabase.auth.startAutoRefresh().catch(() => {
              // Stale token — sign out silently so the user lands on the login screen
              supabase.auth.signOut().catch(() => {});
            });
          } else {
            supabase.auth.stopAutoRefresh();
          }
        });

        // Flag so the listener ignores the SIGNED_IN that fires on startup —
        // the initial session is handled below by getSession() instead.
        let initialSessionHandled = false;

        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            set({ isPasswordRecovery: true });
            return;
          }

          // Let getSession() own the first load so we never double-fetch
          if (!initialSessionHandled) return;

          // Token refresh: just swap the session object, no extra DB calls
          if (event === 'TOKEN_REFRESHED' && session) {
            set({ session });
            return;
          }

          if (session?.user) {
            const [profile, memberData, consentOk] = await Promise.all([
              fetchProfile(session.user.id, session.user.user_metadata as Record<string, unknown>),
              fetchMemberData(session.user.id),
              hasCurrentConsent(session.user.id),
            ]);
            identifyUser(session.user.id);
            set({ user: session.user, session, profile, houseId: memberData.houseId, role: memberData.role, permissions: memberData.permissions, needsTermsAcceptance: !consentOk });
            if (memberData.houseId) {
              registerPushToken(session.user.id, memberData.houseId);
              registerWebPush(session.user.id, memberData.houseId);
            }
          } else {
            const prev = useAuthStore.getState();
            if (prev.user && prev.houseId) {
              unregisterPushToken(prev.user.id, prev.houseId);
              unregisterWebPush(prev.user.id, prev.houseId);
            }
            clearUser();
            set({ user: null, session: null, profile: null, houseId: null, role: null, permissions: DEFAULT_PERMISSIONS });
          }
        });

        // Restore pending verification email across restarts
        const restoredEmail = await loadPendingEmail();
        if (restoredEmail) set({ pendingEmail: restoredEmail });

        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          // Invalid / expired refresh token — clear it so the user is redirected to login
          if (sessionError) {
            await supabase.auth.signOut().catch(() => {});
            set({ isLoading: false });
            return;
          }
          if (session?.user) {
            const [profile, memberData, consentOk] = await Promise.all([
              fetchProfile(session.user.id, session.user.user_metadata as Record<string, unknown>),
              fetchMemberData(session.user.id),
              hasCurrentConsent(session.user.id),
            ]);
            identifyUser(session.user.id);
            set({ user: session.user, session, profile, houseId: memberData.houseId, role: memberData.role, permissions: memberData.permissions, needsTermsAcceptance: !consentOk, isLoading: false });
            if (memberData.houseId) {
              registerPushToken(session.user.id, memberData.houseId);
              registerWebPush(session.user.id, memberData.houseId);
            }
          } else {
            set({ isLoading: false });
          }
        } catch (err) {
          captureError(err, { context: 'auth-initialize' });
          set({ isLoading: false });
        } finally {
          initialSessionHandled = true;
        }
      },

      signUp: async (email, password, name, avatarColor): Promise<{ needsVerification: boolean }> => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, avatar_color: avatarColor } },
          });
          if (error) throw error;
          if (data.user) {
            // Record consent immediately after account creation (clickwrap legal evidence).
            // Best-effort — failure here must not block account creation.
            supabase.from('user_consents').insert({
              user_id: data.user.id,
              terms_version: CURRENT_TERMS_VERSION,
              platform: Platform.OS,
            }).then(({ error: consentErr }) => {
              if (consentErr) captureError(consentErr, { context: 'record-consent', userId: data.user?.id ?? '' });
            });

            // If session is null, email confirmation is required.
            // The handle_new_user trigger already created the profile row — no insert needed here.
            if (!data.session) {
              set({ pendingEmail: email, isLoading: false });
              savePendingEmail(email).catch(() => {});
              return { needsVerification: true };
            }
            const profile = await fetchProfile(data.user.id, data.user.user_metadata as Record<string, unknown>);
            set({ user: data.user, session: data.session, profile, isLoading: false });
          }
          return { needsVerification: false };
        } catch (err) {
          const message = sanitizeAuthError(err);
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      resendVerification: async (email): Promise<void> => {
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) throw new Error('Could not resend. Please try again.');
      },

      signIn: async (email, password): Promise<void> => {
        set({ isLoading: true, error: null });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          if (data.user) {
            const [profile, memberData, consentOk] = await Promise.all([
              fetchProfile(data.user.id, data.user.user_metadata as Record<string, unknown>),
              fetchMemberData(data.user.id),
              hasCurrentConsent(data.user.id),
            ]);
            clearPendingEmail().catch(() => {});
            set({ user: data.user, session: data.session, profile, houseId: memberData.houseId, role: memberData.role, permissions: memberData.permissions, needsTermsAcceptance: !consentOk, isLoading: false, pendingEmail: null });
            if (memberData.houseId) {
              registerPushToken(data.user.id, memberData.houseId);
              registerWebPush(data.user.id, memberData.houseId);
            }
          }
        } catch (err) {
          const message = sanitizeAuthError(err);
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      signOut: async (): Promise<void> => {
        // Unregister push tokens before clearing state so we still have the IDs.
        // Done here explicitly because if signOut() fails (expired token), onAuthStateChange
        // never fires and tokens would otherwise remain registered indefinitely.
        const { user: prevUser, houseId: prevHouseId } = useAuthStore.getState();
        if (prevUser && prevHouseId) {
          unregisterPushToken(prevUser.id, prevHouseId);
          unregisterWebPush(prevUser.id, prevHouseId);
        }
        // Clear local state regardless of whether the Supabase call succeeds
        // (e.g. expired token will cause signOut to fail but user should still be logged out locally)
        await supabase.auth.signOut().catch(() => {});
        clearPendingEmail().catch(() => {});
        set({ user: null, session: null, profile: null, houseId: null, role: null, permissions: DEFAULT_PERMISSIONS, pendingEmail: null });
      },

      updateProfile: async (name: string): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user) return;
        const { error } = await supabase
          .from('profiles')
          .update({ name })
          .eq('id', user.id);
        if (error) throw new Error('Could not update name. Please try again.');
        set((s) => ({ profile: s.profile ? { ...s.profile, name } : s.profile }));
      },

      updateEmail: async (email: string): Promise<void> => {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw new Error('Could not update email. Please try again.');
      },

      changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user?.email) throw new Error('Not signed in.');
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });
        if (verifyError) throw new Error('Current password is incorrect.');
        if (newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
        if (!/[A-Z]/.test(newPassword)) throw new Error('Password must include at least one uppercase letter.');
        if (!/[0-9]/.test(newPassword)) throw new Error('Password must include at least one number.');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error('Could not update password. Please try again.');
        // Sign out all other sessions (other devices) so only this device stays logged in
        await supabase.auth.signOut({ scope: 'others' });
      },

      uploadAvatar: async (uri: string, mimeType = 'image/jpeg', base64?: string): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user) return;
        const path = `${user.id}/avatar`;
        const { buffer, contentType } = await resolveUploadData(uri, mimeType, base64);
        if (buffer.byteLength > 5 * 1024 * 1024) throw new Error('Photo must be under 5 MB. Please crop or compress the image.');
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(path, buffer, { contentType, upsert: true });
        if (uploadError) { captureError(uploadError, { context: 'upload-avatar' }); throw new Error('Could not upload photo. Please try again.'); }
        // Store a marker so fetchProfile knows a photo exists.
        // We do NOT store a signed/public URL because those can expire or be inaccessible
        // if the bucket public flag isn't set — instead we always generate a fresh signed URL.
        const placeholder = `profiles:${path}`;
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: placeholder })
          .eq('id', user.id);
        if (updateError) { captureError(updateError, { context: 'update-avatar-url' }); throw new Error('Could not save photo. Please try again.'); }
        // Generate a signed URL for immediate display (bypasses public-bucket requirement)
        const { data: signed } = await supabase.storage
          .from('profiles')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (!signed?.signedUrl) throw new Error('Could not generate photo URL. Please try again.');
        set((s) => ({ profile: s.profile ? { ...s.profile, avatarUrl: signed.signedUrl } : s.profile }));
      },

      removeAvatar: async (): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user) return;
        await supabase.storage.from('profiles').remove([`${user.id}/avatar`]);
        await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
        set((s) => ({ profile: s.profile ? { ...s.profile, avatarUrl: undefined } : s.profile }));
      },

      uploadCover: async (uri: string, mimeType = 'image/jpeg', base64?: string): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user) return;
        const path = `${user.id}/cover`;
        const { buffer, contentType } = await resolveUploadData(uri, mimeType, base64);
        if (buffer.byteLength > 10 * 1024 * 1024) throw new Error('Cover photo must be under 10 MB. Please use a smaller image.');
        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(path, buffer, { contentType, upsert: true });
        if (uploadError) { captureError(uploadError, { context: 'upload-cover' }); throw new Error('Could not upload cover photo. Please try again.'); }
        const placeholder = `profiles:${path}`;
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ cover_url: placeholder })
          .eq('id', user.id);
        if (updateError) { captureError(updateError, { context: 'update-cover-url' }); throw new Error('Could not save cover photo. Please try again.'); }
        const { data: signed } = await supabase.storage
          .from('profiles')
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        if (!signed?.signedUrl) throw new Error('Could not generate cover URL. Please try again.');
        set((s) => ({ profile: s.profile ? { ...s.profile, coverUrl: signed.signedUrl } : s.profile }));
      },

      removeCover: async (): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user) return;
        await supabase.storage.from('profiles').remove([`${user.id}/cover`]);
        await supabase.from('profiles').update({ cover_url: null }).eq('id', user.id);
        set((s) => ({ profile: s.profile ? { ...s.profile, coverUrl: undefined } : s.profile }));
      },

      setHouseId: (houseId): void => {
        set({ houseId });
        const userId = useAuthStore.getState().user?.id;
        if (userId) cacheHouseId(userId, houseId).catch(() => {});
      },

      reloadMembership: async (): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user) return;
        const memberData = await fetchMemberData(user.id);
        set({ houseId: memberData.houseId, role: memberData.role, permissions: memberData.permissions });
      },

      leaveHouse: async (): Promise<void> => {
        const { user, houseId } = useAuthStore.getState();
        if (!user || !houseId) return;
        try {
          await supabase
            .from('house_members')
            .delete()
            .eq('user_id', user.id)
            .eq('house_id', houseId);
        } catch { /* non-fatal */ }
        // Unregister push tokens so ex-housemates don't receive stale notifications
        unregisterPushToken(user.id, houseId);
        unregisterWebPush(user.id, houseId);
        await clearCachedHouseId(user.id).catch(() => {});
        set({ houseId: null, role: null, permissions: DEFAULT_PERMISSIONS });
      },

      deleteAccount: async (): Promise<void> => {
        const { session, user, houseId } = useAuthStore.getState();
        if (!session || !user) throw new Error('Not signed in.');
        // Unregister push tokens before deletion
        if (houseId) {
          unregisterPushToken(user.id, houseId);
          unregisterWebPush(user.id, houseId);
        }
        const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
        const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? 'Could not delete account. Please try again or contact support@housemates.app.');
        }
        // Clear all local state — the auth user is now gone server-side
        await clearCachedHouseId(user.id).catch(() => {});
        set({ user: null, session: null, profile: null, houseId: null, role: null, permissions: DEFAULT_PERMISSIONS });
      },

      acceptUpdatedTerms: async (): Promise<void> => {
        const { user } = useAuthStore.getState();
        if (!user) return;
        set({ isLoading: true });
        const { error } = await supabase.from('user_consents').insert({
          user_id: user.id,
          terms_version: CURRENT_TERMS_VERSION,
          platform: Platform.OS,
        });
        if (error) {
          captureError(error, { context: 'accept-updated-terms', userId: user.id });
          set({ isLoading: false });
          throw new Error('Could not record acceptance. Please try again.');
        }
        set({ needsTermsAcceptance: false, isLoading: false });
      },

      clearError: (): void => {
        set({ error: null });
      },
      clearPasswordRecovery: (): void => {
        set({ isPasswordRecovery: false });
      },
    }),
    { name: 'auth-store' }
  )
);

// Supabase Storage recommended pattern for Expo/React Native:
// upload as ArrayBuffer with explicit contentType.
// base64 string from expo-image-picker may include a data URL prefix on web
// (e.g. "data:image/jpeg;base64,....") — strip it before decoding.
async function resolveUploadData(
  uri: string,
  mimeType: string,
  base64?: string | null
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  if (base64) {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { buffer: bytes.buffer, contentType: mimeType };
  }
  // Fallback for native (uri is a stable file:// path there)
  const response = await fetch(uri);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  return { buffer, contentType: blob.type || mimeType };
}

async function hasCurrentConsent(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('user_consents')
      .select('id')
      .eq('user_id', userId)
      .eq('terms_version', CURRENT_TERMS_VERSION)
      .maybeSingle();
    return !!data;
  } catch {
    // If the check fails (network error etc.) require re-acceptance to be safe.
    return false;
  }
}

async function fetchProfile(
  userId: string,
  userMeta?: Record<string, unknown>
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar_color, avatar_url, cover_url')
    .eq('id', userId)
    .maybeSingle();

  if (data) {
    // Generate fresh signed URLs so photos work regardless of bucket public flag.
    // The DB value may be a placeholder ('profiles:userId/avatar'), a legacy URL,
    // or anything truthy — we only care that a file was uploaded, not the stored value.
    let avatarUrl: string | undefined;
    let coverUrl: string | undefined;
    if (data.avatar_url) {
      const { data: signed } = await supabase.storage
        .from('profiles')
        .createSignedUrl(`${userId}/avatar`, 60 * 60 * 24 * 365);
      avatarUrl = signed?.signedUrl;
    }
    if (data.cover_url) {
      const { data: signed } = await supabase.storage
        .from('profiles')
        .createSignedUrl(`${userId}/cover`, 60 * 60 * 24 * 365);
      coverUrl = signed?.signedUrl;
    }
    return { id: data.id, name: data.name, avatarColor: data.avatar_color, avatarUrl, coverUrl };
  }

  // Profile row missing — create it from auth metadata so the app works immediately
  if (!userMeta) return null;
  const name = (userMeta.name as string) || (userMeta.full_name as string) || 'You';
  const avatarColor = (userMeta.avatar_color as string) || '#6366f1';

  await supabase.from('profiles').upsert({ id: userId, name, avatar_color: avatarColor });
  return { id: userId, name, avatarColor };
}

async function fetchMemberData(userId: string): Promise<{ houseId: string | null; role: MemberRole | null; permissions: MemberPermissions }> {
  // Order by joined_at DESC so the most recently joined house wins when a user
  // belongs to multiple houses (e.g. left one and joined another).
  const { data, error } = await supabase
    .from('house_members')
    .select('house_id, role, permissions')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1);

  const row = data?.[0];

  if (!error && row?.house_id) {
    // Verify the house still exists — a stale house_members row (e.g. from a
    // deleted test house) would otherwise put the user into a nameless ghost house.
    const { data: houseCheck } = await supabase
      .from('houses')
      .select('id')
      .eq('id', row.house_id)
      .maybeSingle();

    if (!houseCheck) {
      // Ghost house — delete the stale membership and clear cache so the user
      // lands on house-setup instead of a broken dashboard.
      await supabase
        .from('house_members')
        .delete()
        .eq('user_id', userId)
        .eq('house_id', row.house_id);
      await clearCachedHouseId(userId);
      return { houseId: null, role: null, permissions: DEFAULT_PERMISSIONS };
    }

    await cacheHouseId(userId, row.house_id);
    return {
      houseId: row.house_id,
      role: (row.role as MemberRole) ?? 'member',
      permissions: { ...DEFAULT_PERMISSIONS, ...(row.permissions as Partial<MemberPermissions>) },
    };
  }

  // DB query failed or returned nothing — try the local cache first
  const cached = await getCachedHouseId(userId);
  if (cached) {
    return { houseId: cached, role: null, permissions: DEFAULT_PERMISSIONS };
  }

  // role/permissions columns may not exist yet — fall back to house_id only
  const { data: fb } = await supabase
    .from('house_members')
    .select('house_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(1);

  const fbHouseId = fb?.[0]?.house_id ?? null;
  if (fbHouseId) await cacheHouseId(userId, fbHouseId);

  return { houseId: fbHouseId, role: null, permissions: DEFAULT_PERMISSIONS };
}
