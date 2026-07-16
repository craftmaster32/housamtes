/**
 * QA — authStore (riskiest untested actions)
 *
 * Covers the auth + data-deleting actions flagged in QUALITY_BASELINE.md:
 *   signIn         — credential errors are sanitized; state fully populated on success
 *   signUp         — duplicate email sanitized; email-verification path saves pendingEmail
 *   signOut        — local state is cleared even when the server call fails,
 *                    and push tokens are unregistered first
 *   changePassword — re-authenticates, enforces password policy, signs out other devices
 *   leaveHouse     — deletes membership and clears house state + push tokens
 *   deleteAccount  — irreversible: guards when signed out, preserves state on server
 *                    failure, clears everything on success
 */

import type { Session, User } from '@supabase/supabase-js';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockAuth = {
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  updateUser: jest.fn(),
  resend: jest.fn(),
  verifyOtp: jest.fn(),
  onAuthStateChange: jest.fn(),
  getSession: jest.fn(),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};
interface StorageChainMock {
  createSignedUrl: (
    ...args: unknown[]
  ) => Promise<{ data: { signedUrl: string } | null; error: Error | null }>;
  upload: (...args: unknown[]) => Promise<{ error: Error | null }>;
  remove: (...args: unknown[]) => Promise<{ error: Error | null }>;
}
const mockStorageFrom = jest.fn<StorageChainMock, []>(() => ({
  createSignedUrl: jest.fn(async () => ({ data: null, error: null })),
  upload: jest.fn(async () => ({ error: null })),
  remove: jest.fn(async () => ({ error: null })),
}));

jest.mock('@lib/supabase', () => ({
  supabase: {
    supabaseUrl: 'https://unit-test.supabase.co',
    from: (...a: unknown[]): unknown => mockFrom(...a),
    // Delegate lazily — jest hoists this factory above the const declarations,
    // so referencing mockAuth directly here would capture undefined.
    auth: {
      signInWithPassword: (...a: unknown[]): unknown => mockAuth.signInWithPassword(...a),
      signUp: (...a: unknown[]): unknown => mockAuth.signUp(...a),
      signOut: (...a: unknown[]): unknown => mockAuth.signOut(...a),
      updateUser: (...a: unknown[]): unknown => mockAuth.updateUser(...a),
      resend: (...a: unknown[]): unknown => mockAuth.resend(...a),
      verifyOtp: (...a: unknown[]): unknown => mockAuth.verifyOtp(...a),
      onAuthStateChange: (...a: unknown[]): unknown => mockAuth.onAuthStateChange(...a),
      getSession: (...a: unknown[]): unknown => mockAuth.getSession(...a),
      startAutoRefresh: (...a: unknown[]): unknown => mockAuth.startAutoRefresh(...a),
      stopAutoRefresh: (...a: unknown[]): unknown => mockAuth.stopAutoRefresh(...a),
    },
    storage: { from: (): unknown => mockStorageFrom() },
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
  },
}));

const mockRegisterPushToken = jest.fn();
const mockUnregisterPushToken = jest.fn();
jest.mock('@lib/notifications', () => ({
  registerPushToken: (...a: unknown[]): unknown => mockRegisterPushToken(...a),
  unregisterPushToken: (...a: unknown[]): unknown => mockUnregisterPushToken(...a),
}));

const mockRegisterWebPush = jest.fn();
const mockUnregisterWebPush = jest.fn();
jest.mock('@lib/webPush', () => ({
  registerWebPush: (...a: unknown[]): unknown => mockRegisterWebPush(...a),
  unregisterWebPush: (...a: unknown[]): unknown => mockUnregisterWebPush(...a),
}));

jest.mock('@lib/errorTracking', () => ({
  identifyUser: jest.fn(),
  clearUser: jest.fn(),
  captureError: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
  deleteItemAsync: jest.fn(async () => undefined),
}));

import { useAuthStore, DEFAULT_PERMISSIONS } from '@stores/authStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fakeUser = (id = 'u1'): User =>
  ({ id, email: 'alice@example.com', user_metadata: {} }) as unknown as User;

const fakeSession = (userId = 'u1'): Session =>
  ({ access_token: 'test-access-token', user: fakeUser(userId) }) as unknown as Session;

/** Route supabase.from(table) to per-table mock chains. */
function mockTables(map: Record<string, unknown>): void {
  mockFrom.mockImplementation((table: string) => map[table] ?? ok(null));
}

/** Standard happy-path DB responses for a signed-in member of house h1. */
function mockMemberOfHouse(): void {
  mockTables({
    profiles: ok({
      id: 'u1',
      name: 'Alice',
      avatar_color: '#6366f1',
      avatar_url: null,
      cover_url: null,
    }),
    house_members: ok([{ house_id: 'h1', role: 'admin', permissions: { bills: true } }]),
    houses: ok({ id: 'h1' }),
    user_consents: ok([{ id: 'c1' }]),
  });
}

function resetStore(): void {
  useAuthStore.setState({
    user: null,
    session: null,
    profile: null,
    houseId: null,
    role: null,
    permissions: DEFAULT_PERMISSIONS,
    isLoading: false,
    error: null,
    pendingEmail: null,
    isPasswordRecovery: false,
    needsTermsAcceptance: false,
  });
}

beforeEach(() => {
  resetStore();
  jest.clearAllMocks();
  mockTables({});
});

// ─────────────────────────────────────────────────────────────────────────────
// signIn
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — signIn', () => {
  it('populates user, session, profile and house membership on success', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: fakeUser(), session: fakeSession() },
      error: null,
    });
    mockMemberOfHouse();

    await useAuthStore.getState().signIn('alice@example.com', 'Password1');

    const s = useAuthStore.getState();
    expect(s.user?.id).toBe('u1');
    expect(s.session).not.toBeNull();
    expect(s.profile).toMatchObject({ id: 'u1', name: 'Alice' });
    expect(s.houseId).toBe('h1');
    expect(s.role).toBe('admin');
    expect(s.needsTermsAcceptance).toBe(false);
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
    // Push registration must happen for house members
    expect(mockRegisterPushToken).toHaveBeenCalledWith('u1', 'h1');
  });

  it('sanitizes invalid credentials — never leaks the raw Supabase message', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error('Invalid login credentials'),
    });

    await expect(useAuthStore.getState().signIn('alice@example.com', 'wrong')).rejects.toThrow(
      'Incorrect email or password'
    );

    const s = useAuthStore.getState();
    expect(s.error).toBe('Incorrect email or password');
    expect(s.user).toBeNull();
    expect(s.isLoading).toBe(false);
  });

  it('maps network failures to a plain-English connection message', async () => {
    mockAuth.signInWithPassword.mockRejectedValue(new Error('Network request failed'));

    await expect(useAuthStore.getState().signIn('alice@example.com', 'Password1')).rejects.toThrow(
      'Connection error. Check your internet and try again'
    );

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('surfaces the unverified-email case with clear instructions', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error('Email not confirmed'),
    });

    await expect(useAuthStore.getState().signIn('alice@example.com', 'Password1')).rejects.toThrow(
      'Please verify your email before signing in'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signUp
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — signUp', () => {
  it('sanitizes the duplicate-email error', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: {},
      error: new Error('User already registered'),
    });

    await expect(
      useAuthStore.getState().signUp('alice@example.com', 'Password1', 'Alice', '#fff')
    ).rejects.toThrow('An account with this email already exists');

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('returns needsVerification and stores pendingEmail when confirmation is required', async () => {
    // session: null ⇒ Supabase requires email verification before sign-in
    mockAuth.signUp.mockResolvedValue({
      data: { user: fakeUser(), session: null },
      error: null,
    });
    mockTables({ user_consents: ok(null) });

    const result = await useAuthStore
      .getState()
      .signUp('alice@example.com', 'Password1', 'Alice', '#fff');

    expect(result).toEqual({ needsVerification: true });
    const s = useAuthStore.getState();
    expect(s.pendingEmail).toBe('alice@example.com');
    expect(s.user).toBeNull(); // not signed in until verified
    expect(s.isLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signOut
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — signOut', () => {
  it('clears all local auth state on success', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      session: fakeSession(),
      houseId: 'h1',
      role: 'member',
      pendingEmail: 'x@y.z',
    });
    mockAuth.signOut.mockResolvedValue({ error: null });

    await useAuthStore.getState().signOut();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.houseId).toBeNull();
    expect(s.role).toBeNull();
    expect(s.pendingEmail).toBeNull();
    expect(s.permissions).toEqual(DEFAULT_PERMISSIONS);
  });

  it('still logs the user out locally when the server call fails (expired token)', async () => {
    useAuthStore.setState({ user: fakeUser(), session: fakeSession(), houseId: 'h1' });
    mockAuth.signOut.mockRejectedValue(new Error('token expired'));

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('unregisters push tokens before clearing state so the IDs are still known', async () => {
    useAuthStore.setState({ user: fakeUser(), session: fakeSession(), houseId: 'h1' });
    mockAuth.signOut.mockResolvedValue({ error: null });

    await useAuthStore.getState().signOut();

    expect(mockUnregisterPushToken).toHaveBeenCalledWith('u1', 'h1');
    expect(mockUnregisterWebPush).toHaveBeenCalledWith('u1', 'h1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// changePassword
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — changePassword', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: fakeUser(), session: fakeSession() });
  });

  it('throws when not signed in', async () => {
    resetStore();

    await expect(useAuthStore.getState().changePassword('old', 'NewPassword1')).rejects.toThrow(
      'Not signed in.'
    );
  });

  it('rejects when the current password is wrong — password is NOT changed', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new Error('Invalid login credentials'),
    });

    await expect(
      useAuthStore.getState().changePassword('wrong-current', 'NewPassword1')
    ).rejects.toThrow('Current password is incorrect.');

    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ['short', 'Ab1', 'Password must be at least 8 characters.'],
    ['no uppercase', 'lowercase1', 'Password must include at least one uppercase letter.'],
    ['no number', 'NoNumberHere', 'Password must include at least one number.'],
  ])('enforces password policy — %s', async (_label, weak, message) => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });

    await expect(useAuthStore.getState().changePassword('Current1', weak)).rejects.toThrow(message);
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it('updates the password and signs out all other devices on success', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    mockAuth.updateUser.mockResolvedValue({ error: null });
    mockAuth.signOut.mockResolvedValue({ error: null });

    await useAuthStore.getState().changePassword('Current1', 'NewPassword1');

    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'NewPassword1' });
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// leaveHouse
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — leaveHouse', () => {
  it('is a no-op when the user has no house', async () => {
    useAuthStore.setState({ user: fakeUser(), houseId: null });

    await useAuthStore.getState().leaveHouse();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockUnregisterPushToken).not.toHaveBeenCalled();
  });

  it('deletes the membership row and clears house state + push tokens', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      houseId: 'h1',
      role: 'member',
      permissions: { ...DEFAULT_PERMISSIONS, bills: false },
    });
    mockTables({ house_members: ok(null) });

    await useAuthStore.getState().leaveHouse();

    expect(mockFrom).toHaveBeenCalledWith('house_members');
    expect(mockUnregisterPushToken).toHaveBeenCalledWith('u1', 'h1');
    expect(mockUnregisterWebPush).toHaveBeenCalledWith('u1', 'h1');
    const s = useAuthStore.getState();
    expect(s.houseId).toBeNull();
    expect(s.role).toBeNull();
    expect(s.permissions).toEqual(DEFAULT_PERMISSIONS);
    // The account itself must survive leaving a house
    expect(s.user?.id).toBe('u1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteAccount
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — deleteAccount', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  interface MockResponse {
    ok: boolean;
    json: () => Promise<unknown>;
  }
  const mockFetch = (ok: boolean, body?: unknown, jsonThrows = false): jest.Mock =>
    jest.fn(
      async (): Promise<MockResponse> => ({
        ok,
        json: async (): Promise<unknown> => {
          if (jsonThrows) throw new Error('no body');
          return body ?? {};
        },
      })
    );

  it('refuses when not signed in', async () => {
    await expect(useAuthStore.getState().deleteAccount()).rejects.toThrow('Not signed in.');
  });

  it('calls the delete-account Edge Function with the session token', async () => {
    useAuthStore.setState({ user: fakeUser(), session: fakeSession(), houseId: 'h1' });
    const fetchMock = mockFetch(true);
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAuthStore.getState().deleteAccount();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://unit-test.supabase.co/functions/v1/delete-account',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-access-token',
        }),
      })
    );
  });

  it('keeps the user signed in when the server rejects the deletion', async () => {
    useAuthStore.setState({ user: fakeUser(), session: fakeSession(), houseId: 'h1' });
    global.fetch = mockFetch(false, {
      error: 'House still has unsettled bills',
    }) as unknown as typeof fetch;

    await expect(useAuthStore.getState().deleteAccount()).rejects.toThrow(
      'House still has unsettled bills'
    );

    // Nothing was cleared — the account still exists server-side
    const s = useAuthStore.getState();
    expect(s.user?.id).toBe('u1');
    expect(s.session).not.toBeNull();
  });

  it('falls back to a plain-English message when the server returns no body', async () => {
    useAuthStore.setState({ user: fakeUser(), session: fakeSession() });
    global.fetch = mockFetch(false, undefined, true) as unknown as typeof fetch;

    await expect(useAuthStore.getState().deleteAccount()).rejects.toThrow(
      'Could not delete account. Please try again or contact support@housemates.app.'
    );
  });

  it('clears every piece of local state after a successful deletion', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      session: fakeSession(),
      houseId: 'h1',
      role: 'owner',
    });
    global.fetch = mockFetch(true) as unknown as typeof fetch;

    await useAuthStore.getState().deleteAccount();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.houseId).toBeNull();
    expect(s.role).toBeNull();
    expect(s.permissions).toEqual(DEFAULT_PERMISSIONS);
    expect(mockUnregisterPushToken).toHaveBeenCalledWith('u1', 'h1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// signUp — happy paths
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — signUp success', () => {
  it('signs the user straight in when no email confirmation is required', async () => {
    mockMemberOfHouse();
    mockAuth.signUp.mockResolvedValue({
      data: { user: fakeUser(), session: fakeSession() },
      error: null,
    });

    const result = await useAuthStore
      .getState()
      .signUp('alice@example.com', 'Password1', 'Alice', '#6366f1');

    expect(result).toEqual({ needsVerification: false });
    const s = useAuthStore.getState();
    expect(s.user?.id).toBe('u1');
    expect(s.session).not.toBeNull();
    expect(s.profile?.name).toBe('Alice');
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('records terms consent for the new account', async () => {
    const consentChain = ok(null);
    mockFrom.mockImplementation((table: string) =>
      table === 'user_consents'
        ? consentChain
        : ({
            profiles: ok({
              id: 'u1',
              name: 'Alice',
              avatar_color: '#6366f1',
              avatar_url: null,
              cover_url: null,
            }),
            house_members: ok([{ house_id: 'h1', role: 'admin', permissions: { bills: true } }]),
            houses: ok({ id: 'h1' }),
          }[table] ?? ok(null))
    );
    mockAuth.signUp.mockResolvedValue({
      data: { user: fakeUser(), session: fakeSession() },
      error: null,
    });

    await useAuthStore.getState().signUp('alice@example.com', 'Password1', 'Alice', '#6366f1');

    expect(mockFrom).toHaveBeenCalledWith('user_consents');
    expect(consentChain.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      terms_version: expect.any(String),
      platform: expect.any(String),
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resendVerification
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — resendVerification', () => {
  it('asks Supabase to resend the signup email', async () => {
    mockAuth.resend.mockResolvedValue({ error: null });

    await useAuthStore.getState().resendVerification('alice@example.com');

    expect(mockAuth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'alice@example.com' });
  });

  it('throws a plain-English error when the resend fails', async () => {
    mockAuth.resend.mockResolvedValue({ error: new Error('rate limit') });

    await expect(useAuthStore.getState().resendVerification('alice@example.com')).rejects.toThrow(
      'Could not resend. Please try again.'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyEmailOtp
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — verifyEmailOtp', () => {
  it('verifies the signup code and signs the user in on success', async (): Promise<void> => {
    mockMemberOfHouse();
    mockAuth.verifyOtp.mockResolvedValue({
      data: { user: fakeUser(), session: fakeSession() },
      error: null,
    });
    useAuthStore.setState({ pendingEmail: 'alice@example.com' });

    await useAuthStore.getState().verifyEmailOtp('alice@example.com', '123456');

    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'alice@example.com',
      token: '123456',
      type: 'signup',
    });
    const s = useAuthStore.getState();
    expect(s.user?.id).toBe('u1');
    expect(s.session).not.toBeNull();
    expect(s.pendingEmail).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it('surfaces an invalid-code error and stays signed out when the code is wrong', async (): Promise<void> => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('Token has expired or is invalid'),
    });

    await expect(
      useAuthStore.getState().verifyEmailOtp('alice@example.com', '000000')
    ).rejects.toThrow('Invalid or expired code. Request a new one');

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe('Invalid or expired code. Request a new one');
  });

  it('rejects a malformed code before calling Supabase', async (): Promise<void> => {
    await expect(
      useAuthStore.getState().verifyEmailOtp('alice@example.com', '12')
    ).rejects.toThrow();
    expect(mockAuth.verifyOtp).not.toHaveBeenCalled();
  });

  it('treats an empty (no user/session) response as a failure, not a silent success', async (): Promise<void> => {
    mockAuth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    await expect(
      useAuthStore.getState().verifyEmailOtp('alice@example.com', '123456')
    ).rejects.toThrow();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(s.error).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateProfile / updateEmail
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — updateProfile', () => {
  it('is a no-op when signed out', async () => {
    await useAuthStore.getState().updateProfile('New Name');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('saves the new name and updates the in-memory profile', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      profile: { id: 'u1', name: 'Old', avatarColor: '#fff' },
    });
    mockTables({ profiles: ok(null) });

    await useAuthStore.getState().updateProfile('New Name');

    expect(useAuthStore.getState().profile?.name).toBe('New Name');
  });

  it('throws and leaves the profile untouched when the update fails', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      profile: { id: 'u1', name: 'Old', avatarColor: '#fff' },
    });
    mockTables({ profiles: fail('db down') });

    await expect(useAuthStore.getState().updateProfile('New Name')).rejects.toThrow(
      'Could not update name. Please try again.'
    );
    expect(useAuthStore.getState().profile?.name).toBe('Old');
  });
});

describe('authStore — updateEmail', () => {
  it('sends the change request to Supabase auth', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null });

    await useAuthStore.getState().updateEmail('new@example.com');

    expect(mockAuth.updateUser).toHaveBeenCalledWith({ email: 'new@example.com' });
  });

  it('throws a plain-English error on failure', async () => {
    mockAuth.updateUser.mockResolvedValue({ error: new Error('nope') });

    await expect(useAuthStore.getState().updateEmail('new@example.com')).rejects.toThrow(
      'Could not update email. Please try again.'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reloadMembership
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — reloadMembership', () => {
  it('is a no-op when signed out', async () => {
    await useAuthStore.getState().reloadMembership();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('refreshes houseId, role and permissions from the database', async () => {
    useAuthStore.setState({ user: fakeUser() });
    mockTables({
      house_members: ok([{ house_id: 'h2', role: 'member', permissions: { bills: false } }]),
      houses: ok({ id: 'h2' }),
    });

    await useAuthStore.getState().reloadMembership();

    const s = useAuthStore.getState();
    expect(s.houseId).toBe('h2');
    expect(s.role).toBe('member');
    expect(s.permissions.bills).toBe(false);
    expect(s.permissions.grocery).toBe(true); // merged over defaults
  });

  it('clears the membership when the house no longer exists (ghost house)', async () => {
    useAuthStore.setState({ user: fakeUser(), houseId: 'h-old', role: 'admin' });
    mockTables({
      house_members: ok([{ house_id: 'h-ghost', role: 'admin', permissions: {} }]),
      houses: ok(null), // house row is gone
    });

    await useAuthStore.getState().reloadMembership();

    const s = useAuthStore.getState();
    expect(s.houseId).toBeNull();
    expect(s.role).toBeNull();
    expect(s.permissions).toEqual(DEFAULT_PERMISSIONS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// acceptUpdatedTerms
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — acceptUpdatedTerms', () => {
  it('is a no-op when signed out', async () => {
    await useAuthStore.getState().acceptUpdatedTerms();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('records consent and clears the needs-acceptance flag', async () => {
    useAuthStore.setState({ user: fakeUser(), needsTermsAcceptance: true });
    mockTables({ user_consents: ok(null) });

    await useAuthStore.getState().acceptUpdatedTerms();

    const s = useAuthStore.getState();
    expect(s.needsTermsAcceptance).toBe(false);
    expect(s.isLoading).toBe(false);
  });

  it('keeps the flag and throws when the insert fails', async () => {
    useAuthStore.setState({ user: fakeUser(), needsTermsAcceptance: true });
    mockTables({ user_consents: fail('insert failed') });

    await expect(useAuthStore.getState().acceptUpdatedTerms()).rejects.toThrow(
      'Could not record acceptance. Please try again.'
    );
    expect(useAuthStore.getState().needsTermsAcceptance).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Small state actions
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — small state actions', () => {
  it('setHouseId stores the id immediately', () => {
    useAuthStore.getState().setHouseId('h9');
    expect(useAuthStore.getState().houseId).toBe('h9');
  });

  it('clearPasswordRecovery resets the recovery flag', () => {
    useAuthStore.setState({ isPasswordRecovery: true });
    useAuthStore.getState().clearPasswordRecovery();
    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });

  it('clearError wipes the error message', () => {
    useAuthStore.setState({ error: 'boom' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Avatar / cover photos
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — avatar and cover', () => {
  const profile = { id: 'u1', name: 'Alice', avatarColor: '#fff', avatarUrl: 'old-url' };

  it('uploadAvatar stores the photo and swaps in a fresh signed URL', async () => {
    useAuthStore.setState({ user: fakeUser(), profile });
    mockTables({ profiles: ok(null) });
    mockStorageFrom.mockReturnValue({
      upload: jest.fn(async () => ({ error: null })),
      remove: jest.fn(async () => ({ error: null })),
      createSignedUrl: jest.fn(async () => ({
        data: { signedUrl: 'https://signed.example/avatar' },
        error: null,
      })),
    });

    // "aGVsbG8=" = base64 for "hello" — small enough to pass the 5 MB guard
    await useAuthStore.getState().uploadAvatar('file:///photo.jpg', 'image/jpeg', 'aGVsbG8=');

    expect(useAuthStore.getState().profile?.avatarUrl).toBe('https://signed.example/avatar');
  });

  it('uploadAvatar throws a plain-English error when the storage upload fails', async () => {
    useAuthStore.setState({ user: fakeUser(), profile });
    mockStorageFrom.mockReturnValue({
      upload: jest.fn(async () => ({ error: new Error('storage down') })),
      remove: jest.fn(async () => ({ error: null })),
      createSignedUrl: jest.fn(async () => ({ data: null, error: null })),
    });

    await expect(
      useAuthStore.getState().uploadAvatar('file:///photo.jpg', 'image/jpeg', 'aGVsbG8=')
    ).rejects.toThrow('Could not upload photo. Please try again.');
    expect(useAuthStore.getState().profile?.avatarUrl).toBe('old-url');
  });

  it('removeAvatar deletes the file and clears the URL from the profile', async () => {
    useAuthStore.setState({ user: fakeUser(), profile });
    mockTables({ profiles: ok(null) });

    await useAuthStore.getState().removeAvatar();

    expect(useAuthStore.getState().profile?.avatarUrl).toBeUndefined();
  });

  it('removeCover clears the cover URL from the profile', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      profile: { ...profile, coverUrl: 'old-cover' },
    });
    mockTables({ profiles: ok(null) });

    await useAuthStore.getState().removeCover();

    expect(useAuthStore.getState().profile?.coverUrl).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// initialize — app-startup session restore
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — initialize', () => {
  it('restores a signed-in session with profile and house membership', async () => {
    mockMemberOfHouse();
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    mockAuth.getSession.mockResolvedValue({
      data: { session: fakeSession() },
      error: null,
    });

    await useAuthStore.getState().initialize();

    const s = useAuthStore.getState();
    expect(s.user?.id).toBe('u1');
    expect(s.profile?.name).toBe('Alice');
    expect(s.houseId).toBe('h1');
    expect(s.role).toBe('admin');
    expect(s.isLoading).toBe(false);
    expect(mockRegisterPushToken).toHaveBeenCalledWith('u1', 'h1');
  });

  it('signs out and stops loading when the stored session is invalid', async () => {
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    mockAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: new Error('invalid refresh token'),
    });
    mockAuth.signOut.mockResolvedValue({ error: null });

    await useAuthStore.getState().initialize();

    expect(mockAuth.signOut).toHaveBeenCalled();
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('lands on the logged-out state when no session exists', async () => {
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await useAuthStore.getState().initialize();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.isLoading).toBe(false);
  });

  it('flags password recovery when Supabase fires PASSWORD_RECOVERY', async () => {
    let authCallback: ((event: string, session: unknown) => Promise<void>) | undefined;
    mockAuth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => Promise<void>) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await useAuthStore.getState().initialize();
    await authCallback?.('PASSWORD_RECOVERY', null);

    expect(useAuthStore.getState().isPasswordRecovery).toBe(true);
  });

  it('swaps in the refreshed session on TOKEN_REFRESHED without refetching data', async () => {
    let authCallback: ((event: string, session: unknown) => Promise<void>) | undefined;
    mockAuth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => Promise<void>) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await useAuthStore.getState().initialize();
    mockFrom.mockClear();

    const refreshed = fakeSession();
    await authCallback?.('TOKEN_REFRESHED', refreshed);

    expect(useAuthStore.getState().session).toBe(refreshed);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('clears local state when the auth listener reports a sign-out', async () => {
    let authCallback: ((event: string, session: unknown) => Promise<void>) | undefined;
    mockAuth.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => Promise<void>) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      }
    );
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await useAuthStore.getState().initialize();
    useAuthStore.setState({ user: fakeUser(), houseId: 'h1' });

    await authCallback?.('SIGNED_OUT', null);

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.houseId).toBeNull();
    expect(mockUnregisterPushToken).toHaveBeenCalledWith('u1', 'h1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// uploadCover
// ─────────────────────────────────────────────────────────────────────────────

describe('authStore — uploadCover', () => {
  it('stores the cover photo and swaps in a fresh signed URL', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      profile: { id: 'u1', name: 'Alice', avatarColor: '#fff' },
    });
    mockTables({ profiles: ok(null) });
    mockStorageFrom.mockReturnValue({
      upload: jest.fn(async () => ({ error: null })),
      remove: jest.fn(async () => ({ error: null })),
      createSignedUrl: jest.fn(async () => ({
        data: { signedUrl: 'https://signed.example/cover' },
        error: null,
      })),
    });

    await useAuthStore.getState().uploadCover('file:///cover.jpg', 'image/jpeg', 'aGVsbG8=');

    expect(useAuthStore.getState().profile?.coverUrl).toBe('https://signed.example/cover');
  });

  it('throws a plain-English error when the cover upload fails', async () => {
    useAuthStore.setState({
      user: fakeUser(),
      profile: { id: 'u1', name: 'Alice', avatarColor: '#fff' },
    });
    mockStorageFrom.mockReturnValue({
      upload: jest.fn(async () => ({ error: new Error('storage down') })),
      remove: jest.fn(async () => ({ error: null })),
      createSignedUrl: jest.fn(async () => ({ data: null, error: null })),
    });

    await expect(
      useAuthStore.getState().uploadCover('file:///cover.jpg', 'image/jpeg', 'aGVsbG8=')
    ).rejects.toThrow('Could not upload cover photo. Please try again.');
  });
});
