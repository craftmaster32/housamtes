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
import { ok } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockAuth = {
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  updateUser: jest.fn(),
  resend: jest.fn(),
  onAuthStateChange: jest.fn(),
  getSession: jest.fn(),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
};
const mockStorageFrom = jest.fn(() => ({
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

import { useAuthStore, DEFAULT_PERMISSIONS } from '../../stores/authStore';

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
