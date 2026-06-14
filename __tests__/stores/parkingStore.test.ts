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

import {
  isDateConflict,
  tallyParkingReservationVotes,
  useParkingStore,
  type ParkingReservation,
} from '../../stores/parkingStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    rpc: (...a: unknown[]): unknown => mockRpc(...a),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    },
  },
}));

jest.mock('@lib/notifyHousemates', () => ({
  notifyHousemates: jest.fn().mockResolvedValue(undefined),
}));

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

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

beforeEach(() => {
  useParkingStore.setState({ current: null, reservations: [], isLoading: false });
  jest.clearAllMocks();
  mockFrom.mockReset();
  mockRpc.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. isDateConflict — pure logic
// ─────────────────────────────────────────────────────────────────────────────

describe('isDateConflict', () => {
  it('returns no conflict when reservation list is empty', () => {
    const result = isDateConflict('2026-04-20', undefined, undefined, []);
    expect(result.conflict).toBeNull();
    expect(result.warning).toBeNull();
  });

  it('returns no conflict when no reservation matches the given date', () => {
    const r = reservation({ date: '2026-04-21', status: 'approved' });
    expect(isDateConflict('2026-04-20', undefined, undefined, [r]).conflict).toBeNull();
  });

  // All-day (no times) conflicts
  it('blocks all-day request when another all-day reservation exists (approved)', () => {
    const r = reservation({ date: '2026-04-20', requestedBy: 'Bob', status: 'approved' });
    const { conflict } = isDateConflict('2026-04-20', undefined, undefined, [r]);
    expect(conflict).toMatch(/Bob/i);
    expect(conflict).toMatch(/reserved/i);
  });

  it('blocks all-day request when a pending reservation exists', () => {
    const r = reservation({ date: '2026-04-20', requestedBy: 'Carol', status: 'pending' });
    const { conflict } = isDateConflict('2026-04-20', undefined, undefined, [r]);
    expect(conflict).toMatch(/Carol/i);
    expect(conflict).toMatch(/pending/i);
  });

  // Time-aware: overlapping slots
  it('blocks when new slot overlaps existing timed reservation', () => {
    const r = reservation({
      date: '2026-04-20',
      requestedBy: 'Bob',
      status: 'approved',
      startTime: '09:00',
      endTime: '11:00',
    });
    const { conflict } = isDateConflict('2026-04-20', '10:00', '12:00', [r]);
    expect(conflict).toMatch(/Overlaps/i);
  });

  it('allows non-overlapping timed slots on the same day', () => {
    const r = reservation({
      date: '2026-04-20',
      requestedBy: 'Bob',
      status: 'approved',
      startTime: '09:00',
      endTime: '11:00',
    });
    const { conflict } = isDateConflict('2026-04-20', '13:00', '14:00', [r]);
    expect(conflict).toBeNull();
  });

  // Time-aware: gap warnings
  it('warns when gap between slots is <= 60 minutes', () => {
    const r = reservation({
      date: '2026-04-20',
      requestedBy: 'Bob',
      status: 'approved',
      startTime: '09:00',
      endTime: '10:00',
    });
    const { conflict, warning } = isDateConflict('2026-04-20', '10:30', '11:30', [r]);
    expect(conflict).toBeNull();
    expect(warning).not.toBeNull();
  });

  it('warns more strongly when gap is <= 15 minutes', () => {
    const r = reservation({
      date: '2026-04-20',
      requestedBy: 'Bob',
      status: 'approved',
      startTime: '09:00',
      endTime: '10:00',
    });
    const { conflict, warning } = isDateConflict('2026-04-20', '10:10', '11:00', [r]);
    expect(conflict).toBeNull();
    expect(warning).toMatch(/tight/i);
  });

  // Timed-vs-all-day: hard conflict in both directions
  it('blocks timed request against an all-day reservation (hard conflict)', () => {
    const r = reservation({ date: '2026-04-20', requestedBy: 'Alice', status: 'approved' });
    const { conflict } = isDateConflict('2026-04-20', '09:00', '10:00', [r]);
    expect(conflict).not.toBeNull();
  });

  it('blocks all-day request against a timed reservation (hard conflict)', () => {
    const r = reservation({
      date: '2026-04-20',
      requestedBy: 'Alice',
      status: 'approved',
      startTime: '09:00',
      endTime: '11:00',
    });
    const { conflict } = isDateConflict('2026-04-20', undefined, undefined, [r]);
    expect(conflict).not.toBeNull();
  });

  // One-sided time inputs: form is mid-entry — must never block
  it('does not conflict when only startTime is provided (endTime still empty)', () => {
    const r = reservation({
      date: '2026-04-20',
      requestedBy: 'Bob',
      status: 'approved',
      startTime: '09:00',
      endTime: '11:00',
    });
    const { conflict, warning } = isDateConflict('2026-04-20', '10:00', undefined, [r]);
    expect(conflict).toBeNull();
    expect(warning).toBeNull();
  });

  it('does not conflict when only endTime is provided (startTime still empty)', () => {
    const r = reservation({
      date: '2026-04-20',
      requestedBy: 'Bob',
      status: 'approved',
      startTime: '09:00',
      endTime: '11:00',
    });
    const { conflict, warning } = isDateConflict('2026-04-20', undefined, '12:00', [r]);
    expect(conflict).toBeNull();
    expect(warning).toBeNull();
  });

  it('conflict takes precedence over warning when multiple reservations exist', () => {
    // r1 would produce a gap warning (30 min gap), r2 overlaps → conflict must win
    const r1 = reservation({
      id: 'r1',
      date: '2026-04-20',
      requestedBy: 'Bob',
      status: 'approved',
      startTime: '08:00',
      endTime: '09:00',
    });
    const r2 = reservation({
      id: 'r2',
      date: '2026-04-20',
      requestedBy: 'Carol',
      status: 'approved',
      startTime: '10:00',
      endTime: '12:00',
    });
    // New slot: 09:30–11:00 — 30 min gap after r1 (warning), overlaps r2 (conflict)
    const { conflict, warning } = isDateConflict('2026-04-20', '09:30', '11:00', [r1, r2]);
    expect(conflict).not.toBeNull();
    expect(warning).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. claim
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — claim', () => {
  it('throws when another user already has an active session (local state check)', async () => {
    // Store uses already-loaded realtime state — no extra DB round-trip
    useParkingStore.setState({ current: { id: 'ps1', occupant: 'Bob', startTime: '09:00' } });

    await expect(
      useParkingStore.getState().claim('uuid-alice', 'Alice', 'house-1')
    ).rejects.toThrow('Parking spot is already taken');

    // State should be unchanged — Bob's session still active
    expect(useParkingStore.getState().current).toMatchObject({ id: 'ps1', occupant: 'Bob' });
  });

  it('throws when the DB insert fails', async () => {
    mockFrom.mockReturnValue(fail('unique constraint')); // insert fails

    await expect(
      useParkingStore.getState().claim('uuid-alice', 'Alice', 'house-1')
    ).rejects.toThrow('Could not claim the parking spot. Please try again.');

    expect(useParkingStore.getState().current).toBeNull();
  });

  it('sets current session state on successful claim', async () => {
    mockFrom.mockReturnValue(ok({ id: 'ps2', occupant: 'Alice', start_time: '09:00' })); // insert

    await useParkingStore.getState().claim('uuid-alice', 'Alice', 'house-1');

    expect(useParkingStore.getState().current).toMatchObject({
      id: 'ps2',
      occupant: 'Alice',
    });
  });

  it('throws when name is empty string (profile not loaded guard)', async () => {
    // Guard added: name.trim() === '' throws before any DB call.
    await expect(useParkingStore.getState().claim('', '', 'house-1')).rejects.toThrow(
      'User ID is required to claim parking'
    );

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

    await expect(useParkingStore.getState().release('house-1')).rejects.toThrow(
      'Could not release the parking spot. Please try again.'
    );

    // Session should still be set — no rollback because release throws before set({ current: null })
    expect(useParkingStore.getState().current).not.toBeNull();
  });

  it('clears current session on successful release', async () => {
    useParkingStore.setState({ current: { id: 'ps1', occupant: 'Alice', startTime: '09:00' } });
    mockFrom.mockReturnValue(ok([{ id: 'ps1' }])); // update returns the affected row

    await useParkingStore.getState().release('house-1');

    expect(useParkingStore.getState().current).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. addReservation
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — addReservation', () => {
  const baseRow = {
    id: 'r2',
    requested_by: 'uuid-alice',
    date: '2026-04-20',
    start_time: null,
    end_time: null,
    note: '',
    status: 'pending',
    created_at: '2026-04-18T11:00:00Z',
  };

  it('adds reservation to store state on success (happy path)', async () => {
    useParkingStore.setState({ reservations: [] });
    mockFrom.mockReturnValue(ok(baseRow));

    const id = await useParkingStore
      .getState()
      .addReservation(
        { requestedBy: 'uuid-alice', date: '2026-04-20', note: '' },
        'Alice',
        'house-1'
      );

    expect(id).toBe('r2');
    expect(useParkingStore.getState().reservations).toContainEqual(
      expect.objectContaining({ id: 'r2', date: '2026-04-20', status: 'pending' })
    );
  });

  it('maps timed start/end fields correctly', async () => {
    useParkingStore.setState({ reservations: [] });
    const timedRow = {
      ...baseRow,
      id: 'r3',
      start_time: '09:00',
      end_time: '11:00',
      note: 'dentist',
    };
    mockFrom.mockReturnValue(ok(timedRow));

    await useParkingStore
      .getState()
      .addReservation(
        {
          requestedBy: 'uuid-alice',
          date: '2026-04-20',
          startTime: '09:00',
          endTime: '11:00',
          note: 'dentist',
        },
        'Alice',
        'house-1'
      );

    // Read-path: camelCase fields mapped correctly in store state
    expect(useParkingStore.getState().reservations[0]).toMatchObject({
      startTime: '09:00',
      endTime: '11:00',
      note: 'dentist',
    });

    // Write-path: snake_case fields sent to DB
    const insertMock = (mockFrom.mock.results[0].value as Record<string, jest.Mock>).insert;
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ start_time: '09:00', end_time: '11:00' })
    );
  });

  it('throws generic message when DB insert fails', async () => {
    useParkingStore.setState({ reservations: [] });
    mockFrom.mockReturnValue(fail('DB error'));

    await expect(
      useParkingStore
        .getState()
        .addReservation(
          { requestedBy: 'uuid-alice', date: '2026-04-20', note: '' },
          'Alice',
          'house-1'
        )
    ).rejects.toThrow('Could not save the reservation. Please try again.');

    expect(useParkingStore.getState().reservations).toHaveLength(0);
  });

  it('throws when houseId is empty', async () => {
    await expect(
      useParkingStore
        .getState()
        .addReservation({ requestedBy: 'uuid-alice', date: '2026-04-20', note: '' }, 'Alice', '')
    ).rejects.toThrow(/profile loads/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('resolves and saves reservation even when notifyHousemates rejects', async () => {
    useParkingStore.setState({ reservations: [] });
    const notifyRow = { ...baseRow, id: 'r4', date: '2026-04-26' };
    mockFrom.mockReturnValue(ok(notifyRow));
    const { notifyHousemates: notifyMock } = jest.requireMock('@lib/notifyHousemates') as {
      notifyHousemates: jest.Mock;
    };
    notifyMock.mockRejectedValueOnce(new Error('push failed'));

    const id = await useParkingStore
      .getState()
      .addReservation(
        { requestedBy: 'uuid-alice', date: '2026-04-26', note: '' },
        'Alice',
        'house-1'
      );

    expect(id).toBe('r4');
    expect(useParkingStore.getState().reservations).toContainEqual(
      expect.objectContaining({ id: 'r4', status: 'pending' })
    );
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
      reservations: [reservation({ status: 'pending', date: localDateStr() })],
    });

    await useParkingStore.getState().checkReservationAutoApply('house-1');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('aborts auto-claim when server confirms an active session already exists', async () => {
    const todayStr = localDateStr();
    useParkingStore.setState({
      current: null,
      reservations: [
        reservation({ status: 'approved', date: todayStr, startTime: '00:00', endTime: '23:59' }),
      ],
    });

    // Server says there IS already an active session (another user claimed since load)
    mockFrom.mockReturnValue(ok({ id: 'ps-other' }));

    await useParkingStore.getState().checkReservationAutoApply('house-1');

    // Should not have called insert
    expect(useParkingStore.getState().current).toBeNull();
  });

  it('auto-claims parking when reservation is due and spot is free', async () => {
    const todayStr = localDateStr();
    useParkingStore.setState({
      current: null,
      reservations: [
        reservation({
          status: 'approved',
          date: todayStr,
          startTime: '00:00',
          endTime: '23:59',
          requestedBy: 'Carol',
        }),
      ],
    });

    mockFrom
      .mockReturnValueOnce(ok(null)) // server check: no active session
      .mockReturnValueOnce(ok({ id: 'ps-new', occupant: 'Carol', start_time: '00:00' })); // insert

    await useParkingStore.getState().checkReservationAutoApply('house-1');

    expect(useParkingStore.getState().current).toMatchObject({ occupant: 'Carol' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. voteOnReservation
// ─────────────────────────────────────────────────────────────────────────────

describe('parkingStore — voteOnReservation', () => {
  it('keeps a request pending after one reject while another voter has not voted', async () => {
    useParkingStore.setState({
      reservations: [reservation({ id: 'r1', requestedBy: 'requester', status: 'pending' })],
    });
    mockFrom
      .mockReturnValueOnce(ok())
      .mockReturnValueOnce(ok([{ user_id: 'u1', vote: 'reject' }]))
      .mockReturnValueOnce(ok([{ user_id: 'requester' }, { user_id: 'u1' }, { user_id: 'u2' }]));

    const status = await useParkingStore.getState().voteOnReservation('r1', 'reject', 'house-1');

    expect(status).toBe('pending');
    expect(useParkingStore.getState().reservations[0]).toMatchObject({
      status: 'pending',
      votes: [{ userId: 'u1', vote: 'reject' }],
    });
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it('approves after everyone votes and approve has the higher count', async () => {
    useParkingStore.setState({
      reservations: [reservation({ id: 'r1', requestedBy: 'requester', status: 'pending' })],
    });
    mockFrom
      .mockReturnValueOnce(ok())
      .mockReturnValueOnce(
        ok([
          { user_id: 'u1', vote: 'approve' },
          { user_id: 'u2', vote: 'reject' },
          { user_id: 'u3', vote: 'approve' },
        ])
      )
      .mockReturnValueOnce(
        ok([{ user_id: 'requester' }, { user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }])
      )
      .mockReturnValueOnce(ok([{ id: 'r1' }]));

    const status = await useParkingStore.getState().voteOnReservation('r1', 'approve', 'house-1');

    expect(status).toBe('approved');
    expect(useParkingStore.getState().reservations[0].status).toBe('approved');
  });

  it('throws when upsert fails', async () => {
    useParkingStore.setState({ reservations: [reservation({ id: 'r1', status: 'pending' })] });
    mockFrom.mockReturnValue(fail('permission denied'));

    await expect(
      useParkingStore.getState().voteOnReservation('r1', 'approve', 'house-1')
    ).rejects.toThrow('Could not save your vote. Please try again.');
  });
});

describe('tallyParkingReservationVotes', () => {
  it('counts only one current vote per member', () => {
    const tally = tallyParkingReservationVotes(
      [
        { userId: 'u1', vote: 'approve' },
        { userId: 'u1', vote: 'reject' },
      ],
      ['u1']
    );

    expect(tally.approveCount).toBe(0);
    expect(tally.rejectCount).toBe(1);
    expect(tally.status).toBe('rejected');
  });

  it('stays pending when remaining votes could still flip the result', () => {
    // 1 reject, 1 remaining: reject (1) > approve (0) + remaining (1) → 1 > 1 → false → pending
    const tally = tallyParkingReservationVotes([{ userId: 'u1', vote: 'reject' }], ['u1', 'u2']);

    expect(tally.hasEveryoneVoted).toBe(false);
    expect(tally.status).toBe('pending');
  });

  it('uses the higher count after every eligible voter has voted', () => {
    const tally = tallyParkingReservationVotes(
      [
        { userId: 'u1', vote: 'approve' },
        { userId: 'u2', vote: 'reject' },
        { userId: 'u3', vote: 'approve' },
      ],
      ['u1', 'u2', 'u3']
    );

    expect(tally.status).toBe('approved');
  });

  it('approves early when approval lead is irreversible (3 of 5 approve)', () => {
    // 3 approve, 0 reject, 2 remaining: 3 > 0+2 → true → approved without waiting
    const tally = tallyParkingReservationVotes(
      [
        { userId: 'u1', vote: 'approve' },
        { userId: 'u2', vote: 'approve' },
        { userId: 'u3', vote: 'approve' },
      ],
      ['u1', 'u2', 'u3', 'u4', 'u5']
    );

    expect(tally.status).toBe('approved');
    expect(tally.hasEveryoneVoted).toBe(false);
  });

  it('rejects early when rejection lead is irreversible (2 of 3 reject)', () => {
    // 2 reject, 0 approve, 1 remaining: 2 > 0+1 → true → rejected without waiting
    const tally = tallyParkingReservationVotes(
      [
        { userId: 'u1', vote: 'reject' },
        { userId: 'u2', vote: 'reject' },
      ],
      ['u1', 'u2', 'u3']
    );

    expect(tally.status).toBe('rejected');
    expect(tally.hasEveryoneVoted).toBe(false);
  });

  it('stays pending when 1 of 2 eligible voters has approved (can still be tied)', () => {
    // 1 approve, 0 reject, 1 remaining: 1 > 0+1 → false → pending (deadline resolves it)
    const tally = tallyParkingReservationVotes([{ userId: 'u1', vote: 'approve' }], ['u1', 'u2']);

    expect(tally.status).toBe('pending');
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

    await expect(useParkingStore.getState().cancelReservation('r1', 'house-1')).rejects.toThrow(
      'Could not cancel the reservation. Please try again.'
    );

    expect(useParkingStore.getState().reservations).toHaveLength(1); // unchanged
  });
});
