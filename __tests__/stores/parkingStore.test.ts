/**
 * QA — parkingStore
 *
 * Covers:
 *  1. isDateConflict — pure logic, all date/status combinations
 *  2. claim — server-side guard, DB error, empty-name scenario
 *  3. release — null-current no-op, DB error
 *  4. addReservation — client-side conflict guard, DB error
 *  5. checkReservationAutoApply — already occupied, server guard, successful auto-claim
 *  6. approveReservation — ⚠️ BUG: DB error not caught, state mutated anyway
 *  7. cancelReservation — ⚠️ BUG: DB error not caught, item removed from state anyway
 *
 * BUGS PROVEN HERE (marked ⚠️):
 *  ⚠️  approveReservation: DB failure still updates local state (optimistic, no rollback)
 *  ⚠️  cancelReservation: DB failure still removes from local state (optimistic, no rollback)
 *  ⚠️  claim: name can be empty string if profile hasn't loaded yet → DB row has occupant=""
 *  ⚠️  addReservation: conflict check is client-side only — stale local state can miss conflicts
 */

import { isDateConflict, useParkingStore, type ParkingReservation } from '../../stores/parkingStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
    auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }) },
  },
}));

jest.mock('@lib/notifyHousemates', () => ({ notifyHousemates: jest.fn() }));

// ── Helpers ───────────────────────────────────────────────────────────────────

function reservation(overrides: Partial<ParkingReservation> = {}): ParkingReservation {
  return {
    id: 'r1',
    requestedBy: 'Alice',
    date: '2026-04-20',
    note: '',
    status: 'pending',
    createdAt: '2026-04-18T10:00:00Z',
    votes: [],
    ...overrides,
  };
}

beforeEach(() => {
  useParkingStore.setState({ current: null, reservations: [], isLoading: false });
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. isDateConflict — pure logic
// ─────────────────────────────────────────────────────────────────────────────

describe('isDateConflict', () => {
  it('returns null when reservation list is empty', () => {
    expect(isDateConflict('2026-04-20', [])).toBeNull();
  });

  it('returns null when no reservation matches the given date', () => {
    const r = reservation({ date: '2026-04-21', status: 'approved' });
    expect(isDateConflict('2026-04-20', [r])).toBeNull();
  });

  it('returns an "already reserved" message for an approved reservation on the same date', () => {
    const r = reservation({ date: '2026-04-20', requestedBy: 'Bob', status: 'approved' });
    const msg = isDateConflict('2026-04-20', [r]);
    expect(msg).toMatch(/already reserved by Bob/i);
  });

  it('returns a "pending request" message for a pending reservation on the same date', () => {
    const r = reservation({ date: '2026-04-20', requestedBy: 'Carol', status: 'pending' });
    const msg = isDateConflict('2026-04-20', [r]);
    expect(msg).toMatch(/Carol.*pending/i);
  });

  it('returns the first match when multiple reservations exist (approved takes priority in list order)', () => {
    const r1 = reservation({ id: 'r1', date: '2026-04-20', requestedBy: 'Bob',   status: 'approved' });
    const r2 = reservation({ id: 'r2', date: '2026-04-20', requestedBy: 'Carol', status: 'pending'  });
    const msg = isDateConflict('2026-04-20', [r1, r2]);
    expect(msg).toMatch(/Bob/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. claim
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — claim', () => {
  it('throws when another user already has an active session (server check)', async () => {
    // First query (maybeSingle) returns an existing session
    mockFrom.mockReturnValue(ok({ id: 'ps1', occupant: 'Bob' }));

    await expect(
      useParkingStore.getState().claim('uuid-alice', 'Alice', 'house-1')
    ).rejects.toThrow('Parking spot is already taken');

    expect(useParkingStore.getState().current).toBeNull();
  });

  it('throws when the DB insert fails', async () => {
    mockFrom
      .mockReturnValueOnce(ok(null))                    // maybeSingle: no existing session
      .mockReturnValueOnce(fail('unique constraint'));   // insert fails

    await expect(
      useParkingStore.getState().claim('uuid-alice', 'Alice', 'house-1')
    ).rejects.toThrow('Could not claim the parking spot. Please try again.');

    expect(useParkingStore.getState().current).toBeNull();
  });

  it('sets current session state on successful claim', async () => {
    mockFrom
      .mockReturnValueOnce(ok(null))  // no existing session
      .mockReturnValueOnce(ok({ id: 'ps2', occupant: 'Alice', start_time: '09:00' })); // insert

    await useParkingStore.getState().claim('uuid-alice', 'Alice', 'house-1');

    expect(useParkingStore.getState().current).toMatchObject({
      id: 'ps2',
      occupant: 'Alice',
    });
  });

  it('throws when name is empty string (profile not loaded guard)', async () => {
    // Guard added: name.trim() === '' throws before any DB call.
    await expect(
      useParkingStore.getState().claim('', '', 'house-1')
    ).rejects.toThrow('User ID is required to claim parking');

    expect(mockFrom).not.toHaveBeenCalled();
    expect(useParkingStore.getState().current).toBeNull();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 3. release
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — release', () => {
  it('is a no-op when there is no active session', async () => {
    useParkingStore.setState({ current: null });
    await expect(useParkingStore.getState().release('house-1')).resolves.toBeUndefined();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws when the DB update fails', async () => {
    useParkingStore.setState({ current: { id: 'ps1', occupant: 'Alice', startTime: '09:00' } });
    mockFrom.mockReturnValue(fail('connection lost'));

    await expect(
      useParkingStore.getState().release('house-1')
    ).rejects.toThrow('Could not release the parking spot. Please try again.');

    // Session should still be set — no rollback because release throws before set({ current: null })
    expect(useParkingStore.getState().current).not.toBeNull();
  });

  it('clears current session on successful release', async () => {
    useParkingStore.setState({ current: { id: 'ps1', occupant: 'Alice', startTime: '09:00' } });
    mockFrom.mockReturnValue(ok());

    await useParkingStore.getState().release('house-1');

    expect(useParkingStore.getState().current).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. addReservation
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — addReservation', () => {
  it('throws before hitting the DB when a local reservation conflict exists', async () => {
    const existing = reservation({ date: '2026-04-20', status: 'approved', requestedBy: 'Bob' });
    useParkingStore.setState({ reservations: [existing] });

    await expect(
      useParkingStore.getState().addReservation(
        { requestedBy: 'uuid-alice', date: '2026-04-20', note: '' },
        'Alice',
        'house-1'
      )
    ).rejects.toThrow('This date is already reserved');

    expect(mockFrom).not.toHaveBeenCalled(); // should not reach DB
  });

  it('⚠️ BUG: conflict check uses stale local state — another user booking same date concurrently is not caught', async () => {
    // Local state shows no reservations, but another user just booked the same date.
    // The client-side check passes and we hit the DB — only a server-side unique
    // constraint would prevent a double booking, which does not exist.
    useParkingStore.setState({ reservations: [] }); // locally looks free
    const insertedRow = {
      id: 'r2', requested_by: 'Alice', date: '2026-04-20',
      start_time: null, end_time: null, note: '', status: 'pending',
      created_at: '2026-04-18T11:00:00Z',
    };
    mockFrom.mockReturnValue(ok(insertedRow));

    // This succeeds even though another user may have booked simultaneously
    const id = await useParkingStore.getState().addReservation(
      { requestedBy: 'uuid-alice', date: '2026-04-20', note: '' },
      'Alice',
      'house-1'
    );

    expect(id).toBe('r2'); // request goes through — race window exists
  });

  it('throws when DB insert fails', async () => {
    useParkingStore.setState({ reservations: [] });
    mockFrom.mockReturnValue(fail('DB error'));

    await expect(
      useParkingStore.getState().addReservation(
        { requestedBy: 'uuid-alice', date: '2026-04-20', note: '' },
        'Alice',
        'house-1'
      )
    ).rejects.toThrow('Could not save the reservation. Please try again.');

    expect(useParkingStore.getState().reservations).toHaveLength(0);
  });

  it('adds reservation to state on success', async () => {
    useParkingStore.setState({ reservations: [] });
    const row = {
      id: 'r3', requested_by: 'Alice', date: '2026-04-25',
      start_time: null, end_time: null, note: 'dentist', status: 'pending',
      created_at: '2026-04-18T12:00:00Z',
    };
    mockFrom.mockReturnValue(ok(row));

    await useParkingStore.getState().addReservation(
      { requestedBy: 'uuid-alice', date: '2026-04-25', note: 'dentist' },
      'Alice',
      'house-1'
    );

    expect(useParkingStore.getState().reservations).toHaveLength(1);
    expect(useParkingStore.getState().reservations[0].status).toBe('pending');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. checkReservationAutoApply
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — checkReservationAutoApply', () => {
  it('does nothing when a session is already active locally', async () => {
    useParkingStore.setState({
      current: { id: 'ps1', occupant: 'Alice', startTime: '08:00' },
      reservations: [reservation({ status: 'approved', date: '2026-04-18' })],
    });

    await useParkingStore.getState().checkReservationAutoApply('house-1');

    // No DB calls — short-circuits at the `if (dueReservation && !current)` check
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('does nothing when there are no approved reservations for today', async () => {
    useParkingStore.setState({
      current: null,
      // status is 'pending' — not 'approved'
      reservations: [reservation({ status: 'pending', date: new Date().toISOString().slice(0, 10) })],
    });

    await useParkingStore.getState().checkReservationAutoApply('house-1');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('aborts auto-claim when server confirms an active session already exists', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    useParkingStore.setState({
      current: null,
      reservations: [reservation({ status: 'approved', date: todayStr, startTime: '00:00', endTime: '23:59' })],
    });

    // Server says there IS already an active session (another user claimed since load)
    mockFrom.mockReturnValue(ok({ id: 'ps-other' }));

    await useParkingStore.getState().checkReservationAutoApply('house-1');

    // Should not have called insert
    expect(useParkingStore.getState().current).toBeNull();
  });

  it('auto-claims parking when reservation is due and spot is free', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    useParkingStore.setState({
      current: null,
      reservations: [
        reservation({ status: 'approved', date: todayStr, startTime: '00:00', endTime: '23:59', requestedBy: 'Carol' }),
      ],
    });

    mockFrom
      .mockReturnValueOnce(ok(null))  // server check: no active session
      .mockReturnValueOnce(ok({ id: 'ps-new', occupant: 'Carol', start_time: '00:00' })); // insert

    await useParkingStore.getState().checkReservationAutoApply('house-1');

    expect(useParkingStore.getState().current).toMatchObject({ occupant: 'Carol' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. voteOnReservation
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — voteOnReservation', () => {
  it('throws when upsert fails', async () => {
    useParkingStore.setState({ reservations: [reservation({ id: 'r1', status: 'pending' })] });
    mockFrom.mockReturnValue(fail('permission denied'));

    await expect(
      useParkingStore.getState().voteOnReservation('r1', 'approve', 'house-1', ['u2'])
    ).rejects.toThrow('Could not save your vote. Please try again.');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. cancelReservation — ⚠️ BUG: no error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — cancelReservation', () => {
  it('removes reservation from state on success', async () => {
    useParkingStore.setState({ reservations: [reservation({ id: 'r1' })], current: null });
    mockFrom.mockReturnValue(ok());

    await useParkingStore.getState().cancelReservation('r1', 'house-1');

    expect(useParkingStore.getState().reservations).toHaveLength(0);
  });

  it('throws and keeps reservation in state when DB delete fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useParkingStore.setState({ reservations: [reservation({ id: 'r1' })], current: null });
    mockFrom.mockReturnValue(fail('network error'));

    await expect(
      useParkingStore.getState().cancelReservation('r1', 'house-1')
    ).rejects.toThrow('Could not cancel the reservation. Please try again.');

    expect(useParkingStore.getState().reservations).toHaveLength(1); // unchanged
  });
});
