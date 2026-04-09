import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { AppState } from 'react-native';
import { supabase } from '@lib/supabase';
import { identifyUser, clearUser, captureError } from '@lib/errorTracking';
import { registerPushToken, unregisterPushToken } from '@lib/notifications';
import type { User, Session } from '@supabase/supabase-js';

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
            supabase.auth.startAutoRefresh();
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
              fetchProfile(session.user.id),
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
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const [profile, memberData] = await Promise.all([
              fetchProfile(session.user.id),
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
            // Create profile row regardless of verification status
            const existingProfile = await fetchProfile(data.user.id);
            if (!existingProfile) {
              await supabase.from('profiles').insert({
                id: data.user.id,
                name,
                avatar_color: avatarColor,
              });
            }
            // If session is null, email confirmation is required
            if (!data.session) {
              set({ pendingEmail: email, isLoading: false });
              return { needsVerification: true };
            }
            const profile = existingProfile ?? { id: data.user.id, name, avatarColor };
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
              fetchProfile(data.user.id),
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
        set({ user: null, session: null, profile: null, houseId: null });
      },

      setHouseId: (houseId): void => {
        set({ houseId });
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

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, avatar_color')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, avatarColor: data.avatar_color };
}

async function fetchMemberData(userId: string): Promise<{ houseId: string | null; role: MemberRole | null; permissions: MemberPermissions }> {
  const { data, error } = await supabase
    .from('house_members')
    .select('house_id, role, permissions')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    // role/permissions columns may not exist yet — fall back to just house_id
    const { data: fb } = await supabase
      .from('house_members')
      .select('house_id')
      .eq('user_id', userId)
      .maybeSingle();
    return { houseId: fb?.house_id ?? null, role: null, permissions: DEFAULT_PERMISSIONS };
  }

  return {
    houseId: data.house_id,
    role: (data.role as MemberRole) ?? 'member',
    permissions: { ...DEFAULT_PERMISSIONS, ...(data.permissions as Partial<MemberPermissions>) },
  };
}
