import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState, Platform } from 'react-native';
import { supabase } from '@lib/supabase';
import { identifyUser, clearUser, captureError } from '@lib/errorTracking';
import { registerPushToken, unregisterPushToken } from '@lib/notifications';
import type { User, Session } from '@supabase/supabase-js';

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
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, name: string, avatarColor: string) => Promise<{ needsVerification: boolean }>;
  resendVerification: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setHouseId: (houseId: string) => void;
  leaveHouse: () => Promise<void>;
  clearError: () => void;
  clearPasswordRecovery: () => void;
}

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

      initialize: async (): Promise<void> => {
        // Refresh tokens when the app comes back to the foreground
        AppState.addEventListener('change', (state) => {
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
            const [profile, memberData] = await Promise.all([
              fetchProfile(session.user.id, session.user.user_metadata as Record<string, unknown>),
              fetchMemberData(session.user.id),
            ]);
            identifyUser(session.user.id);
            set({ user: session.user, session, profile, houseId: memberData.houseId, role: memberData.role, permissions: memberData.permissions });
            if (memberData.houseId) {
              registerPushToken(session.user.id, memberData.houseId);
            }
          } else {
            const prev = useAuthStore.getState();
            if (prev.user && prev.houseId) {
              unregisterPushToken(prev.user.id, prev.houseId);
            }
            clearUser();
            set({ user: null, session: null, profile: null, houseId: null, role: null, permissions: DEFAULT_PERMISSIONS });
          }
        });

        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          // Invalid / expired refresh token — clear it so the user is redirected to login
          if (sessionError) {
            await supabase.auth.signOut().catch(() => {});
            set({ isLoading: false });
            return;
          }
          if (session?.user) {
            const [profile, memberData] = await Promise.all([
              fetchProfile(session.user.id, session.user.user_metadata as Record<string, unknown>),
              fetchMemberData(session.user.id),
            ]);
            identifyUser(session.user.id);
            set({ user: session.user, session, profile, houseId: memberData.houseId, role: memberData.role, permissions: memberData.permissions, isLoading: false });
            if (memberData.houseId) registerPushToken(session.user.id, memberData.houseId);
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
            // If session is null, email confirmation is required.
            // The handle_new_user trigger already created the profile row — no insert needed here.
            if (!data.session) {
              set({ pendingEmail: email, isLoading: false });
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
            const [profile, memberData] = await Promise.all([
              fetchProfile(data.user.id, data.user.user_metadata as Record<string, unknown>),
              fetchMemberData(data.user.id),
            ]);
            set({ user: data.user, session: data.session, profile, houseId: memberData.houseId, role: memberData.role, permissions: memberData.permissions, isLoading: false });
          }
        } catch (err) {
          const message = sanitizeAuthError(err);
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      signOut: async (): Promise<void> => {
        await supabase.auth.signOut();
        set({ user: null, session: null, profile: null, houseId: null, role: null, permissions: DEFAULT_PERMISSIONS });
      },

      setHouseId: (houseId): void => {
        set({ houseId });
        const userId = useAuthStore.getState().user?.id;
        if (userId) cacheHouseId(userId, houseId).catch(() => {});
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
        // Always clear cache regardless of whether the DB delete succeeded
        await clearCachedHouseId(user.id).catch(() => {});
        set({ houseId: null, role: null });
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

async function fetchProfile(
  userId: string,
  userMeta?: Record<string, unknown>
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar_color')
    .eq('id', userId)
    .maybeSingle();

  if (data) return { id: data.id, name: data.name, avatarColor: data.avatar_color };

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
