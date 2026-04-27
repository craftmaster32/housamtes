/**
 * QA — choresStore
 *
 * The central bug in this store: EVERY mutation (toggle, claim, unclaim, delete,
 * resetAll) updates local state BEFORE checking whether the DB call succeeded.
 * When the DB call fails (no try/catch, no error check), state is permanently
 * wrong until the next full reload — which only happens on navigation or realtime
 * events. Users see false confirmation of an action that never actually saved.
 *
 * BUGS PROVEN HERE (marked ⚠️):
 *  ⚠️  toggleChore  — optimistic update not rolled back on DB failure
 *  ⚠️  claimChore   — optimistic update not rolled back on DB failure
 *  ⚠️  unclaimChore — optimistic update not rolled back on DB failure
 *  ⚠️  deleteChore  — optimistic update not rolled back on DB failure
 *  ⚠️  resetAll     — optimistic update not rolled back on DB failure
 */

import { useChoresStore, type Chore } from '../../stores/choresStore';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function chore(overrides: Partial<Chore> = {}): Chore {
  return {
    id: 'c1',
    name: 'Vacuum',
    claimedBy: null,
    recurrence: 'once',
    recurrenceDay: null,
    isComplete: false,
    completedAt: null,
    createdAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  useChoresStore.setState({ chores: [], isLoading: false });
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleChore
// ─────────────────────────────────────────────────────────────────────────────

describe('choresStore — toggleChore', () => {
  it('is a no-op when the chore id is not found in state', async () => {
    useChoresStore.setState({ chores: [chore({ id: 'c1' })] });

    await useChoresStore.getState().toggleChore('nonexistent');

    expect(mockFrom).not.toHaveBeenCalled();
    expect(useChoresStore.getState().chores[0].isComplete).toBe(false);
  });

  it('marks chore complete and records completedAt on success', async () => {
    useChoresStore.setState({ chores: [chore({ id: 'c1', isComplete: false })] });
    mockFrom.mockReturnValue(ok());

    await useChoresStore.getState().toggleChore('c1');

    const updated = useChoresStore.getState().chores[0];
    expect(updated.isComplete).toBe(true);
    expect(updated.completedAt).not.toBeNull();
  });

  it('toggles back to incomplete and clears completedAt', async () => {
    useChoresStore.setState({
      chores: [chore({ id: 'c1', isComplete: true, completedAt: '2026-04-18T10:00:00Z' })],
    });
    mockFrom.mockReturnValue(ok());

    await useChoresStore.getState().toggleChore('c1');

    expect(useChoresStore.getState().chores[0].isComplete).toBe(false);
    expect(useChoresStore.getState().chores[0].completedAt).toBeNull();
  });

  it('throws and leaves isComplete unchanged when DB update fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useChoresStore.setState({ chores: [chore({ id: 'c1', isComplete: false })] });
    mockFrom.mockReturnValue(fail('write failed'));

    await expect(
      useChoresStore.getState().toggleChore('c1')
    ).rejects.toThrow('Could not update the chore. Please try again.');

    expect(useChoresStore.getState().chores[0].isComplete).toBe(false); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// claimChore
// ─────────────────────────────────────────────────────────────────────────────

describe('choresStore — claimChore', () => {
  it('sets claimedBy on success', async () => {
    useChoresStore.setState({ chores: [chore({ id: 'c1', claimedBy: null })] });
    mockFrom.mockReturnValue(ok());

    await useChoresStore.getState().claimChore('c1', 'Alice');

    expect(useChoresStore.getState().chores[0].claimedBy).toBe('Alice');
  });

  it('throws and leaves claimedBy unchanged when DB update fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useChoresStore.setState({ chores: [chore({ id: 'c1', claimedBy: null })] });
    mockFrom.mockReturnValue(fail('connection error'));

    await expect(
      useChoresStore.getState().claimChore('c1', 'Bob')
    ).rejects.toThrow('Could not claim the chore. Please try again.');

    expect(useChoresStore.getState().chores[0].claimedBy).toBeNull(); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// unclaimChore
// ─────────────────────────────────────────────────────────────────────────────

describe('choresStore — unclaimChore', () => {
  it('clears claimedBy on success', async () => {
    useChoresStore.setState({ chores: [chore({ id: 'c1', claimedBy: 'Alice' })] });
    mockFrom.mockReturnValue(ok());

    await useChoresStore.getState().unclaimChore('c1');

    expect(useChoresStore.getState().chores[0].claimedBy).toBeNull();
  });

  it('throws and keeps claimedBy unchanged when DB update fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useChoresStore.setState({ chores: [chore({ id: 'c1', claimedBy: 'Alice' })] });
    mockFrom.mockReturnValue(fail('server error'));

    await expect(
      useChoresStore.getState().unclaimChore('c1')
    ).rejects.toThrow('Could not unclaim the chore. Please try again.');

    expect(useChoresStore.getState().chores[0].claimedBy).toBe('Alice'); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteChore
// ─────────────────────────────────────────────────────────────────────────────

describe('choresStore — deleteChore', () => {
  it('removes chore from state on success', async () => {
    useChoresStore.setState({ chores: [chore({ id: 'c1' })] });
    mockFrom.mockReturnValue(ok());

    await useChoresStore.getState().deleteChore('c1');

    expect(useChoresStore.getState().chores).toHaveLength(0);
  });

  it('throws and keeps chore in state when DB delete fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useChoresStore.setState({ chores: [chore({ id: 'c1', name: 'Dishes' })] });
    mockFrom.mockReturnValue(fail('RLS denied'));

    await expect(
      useChoresStore.getState().deleteChore('c1')
    ).rejects.toThrow('Could not delete the chore. Please try again.');

    expect(useChoresStore.getState().chores).toHaveLength(1); // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetAll
// ─────────────────────────────────────────────────────────────────────────────

describe('choresStore — resetAll', () => {
  it('marks all chores as incomplete and unassigned on success', async () => {
    useChoresStore.setState({
      chores: [
        chore({ id: 'c1', isComplete: true,  claimedBy: 'Alice', completedAt: '2026-04-10T00:00:00Z' }),
        chore({ id: 'c2', isComplete: false, claimedBy: 'Bob'   }),
      ],
    });
    mockFrom.mockReturnValue(ok());

    await useChoresStore.getState().resetAll('house-1');

    const chores = useChoresStore.getState().chores;
    expect(chores.every((c) => !c.isComplete)).toBe(true);
    expect(chores.every((c) => c.claimedBy === null)).toBe(true);
    expect(chores.every((c) => c.completedAt === null)).toBe(true);
  });

  it('throws and leaves all chores unchanged when DB update fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useChoresStore.setState({
      chores: [chore({ id: 'c1', isComplete: true, claimedBy: 'Alice' })],
    });
    mockFrom.mockReturnValue(fail('timeout'));

    await expect(
      useChoresStore.getState().resetAll('house-1')
    ).rejects.toThrow('Could not reset chores. Please try again.');

    const c = useChoresStore.getState().chores[0];
    expect(c.isComplete).toBe(true);        // unchanged
    expect(c.claimedBy).toBe('Alice');      // unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addChore
// ─────────────────────────────────────────────────────────────────────────────

describe('choresStore — addChore', () => {
  it('throws and does NOT add to state when DB insert fails', async () => {
    mockFrom.mockReturnValue(fail('RLS denied'));

    await expect(
      useChoresStore.getState().addChore('Dishes', 'weekly', 'Monday', 'house-1')
    ).rejects.toThrow('Could not save the chore. Please try again.');

    expect(useChoresStore.getState().chores).toHaveLength(0);
  });

  it('adds chore to state with correct defaults on success', async () => {
    const row = {
      id: 'c-new', title: 'Dishes', recurrence: 'weekly',
      recurrence_day: 'Monday', is_done: false, completed_at: null,
      assigned_to: null, created_at: '2026-04-18T00:00:00Z',
    };
    mockFrom.mockReturnValue(ok(row));

    await useChoresStore.getState().addChore('Dishes', 'weekly', 'Monday', 'house-1');

    const added = useChoresStore.getState().chores[0];
    expect(added.name).toBe('Dishes');
    expect(added.isComplete).toBe(false);
    expect(added.claimedBy).toBeNull();
    expect(added.recurrence).toBe('weekly');
    expect(added.recurrenceDay).toBe('Monday');
  });
});
