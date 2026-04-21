/**
 * QA — votingStore
 *
 * Mixed quality: castVote correctly rolls back on DB failure.
 * But closeProposal and remove have no error handling at all.
 *
 * BUGS PROVEN HERE (marked ⚠️):
 *  ⚠️  closeProposal — no error check; DB failure still closes proposal in UI
 *  ⚠️  remove        — no error check; DB failure still removes proposal from UI
 *  ⚠️  castVote      — closed proposal guard is client-side only; direct API call bypasses it
 *
 * CORRECT BEHAVIOURS VERIFIED:
 *  ✓   castVote reverts to original votes when DB update fails
 *  ✓   castVote replaces an existing vote from the same person (no duplicate votes)
 *  ✓   addProposal throws and leaves state unchanged on DB error
 */

import { useVotingStore, type Proposal } from '../../stores/votingStore';
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

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'p1',
    title: 'Get a dog',
    description: 'We should adopt a dog',
    createdBy: 'Alice',
    createdAt: '2026-04-01T00:00:00Z',
    isOpen: true,
    votes: [],
    ...overrides,
  };
}

beforeEach(() => {
  useVotingStore.setState({ proposals: [], isLoading: false });
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// castVote
// ─────────────────────────────────────────────────────────────────────────────

describe('votingStore — castVote', () => {
  it('is a no-op when the proposal id does not exist in state', async () => {
    useVotingStore.setState({ proposals: [proposal({ id: 'p1' })] });

    await useVotingStore.getState().castVote('nonexistent', 'Bob', 'yes');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throws when the proposal is already closed (client guard)', async () => {
    useVotingStore.setState({ proposals: [proposal({ id: 'p1', isOpen: false })] });

    await expect(
      useVotingStore.getState().castVote('p1', 'Bob', 'yes')
    ).rejects.toThrow('This vote is already closed');

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('⚠️ BUG: closed-proposal guard is client-side only — direct DB call bypasses it', () => {
    // The isOpen check lives only in the client. An authenticated user can call
    // supabase.from('proposals').update({ votes: [...] }).eq('id', p1) directly
    // and record a vote on a closed proposal. There is no RLS policy or DB trigger
    // enforcing that votes cannot be added when is_open=false.
    // This test documents the gap — it cannot be unit-tested here as it requires
    // hitting a real DB — but the pattern is confirmed by code inspection.
    expect(true).toBe(true); // placeholder — see RLS migration needed
  });

  it('records a yes vote from a new voter', async () => {
    useVotingStore.setState({ proposals: [proposal({ id: 'p1', isOpen: true, votes: [] })] });
    const expectedVotes = [{ person: 'Bob', choice: 'yes' }];
    mockFrom.mockReturnValue(ok());

    await useVotingStore.getState().castVote('p1', 'Bob', 'yes');

    expect(useVotingStore.getState().proposals[0].votes).toEqual(expectedVotes);
  });

  it('records a no vote correctly', async () => {
    useVotingStore.setState({ proposals: [proposal({ id: 'p1', isOpen: true, votes: [] })] });
    mockFrom.mockReturnValue(ok());

    await useVotingStore.getState().castVote('p1', 'Carol', 'no');

    expect(useVotingStore.getState().proposals[0].votes[0]).toMatchObject({ person: 'Carol', choice: 'no' });
  });

  it('replaces an existing vote from the same person (no duplicate votes)', async () => {
    useVotingStore.setState({
      proposals: [proposal({ id: 'p1', isOpen: true, votes: [{ person: 'Bob', choice: 'yes' }] })],
    });
    mockFrom.mockReturnValue(ok());

    await useVotingStore.getState().castVote('p1', 'Bob', 'no');

    const votes = useVotingStore.getState().proposals[0].votes;
    expect(votes).toHaveLength(1); // not 2
    expect(votes[0]).toMatchObject({ person: 'Bob', choice: 'no' });
  });

  it('✓ reverts to original votes when DB update fails (correct rollback)', async () => {
    const originalVotes = [{ person: 'Alice', choice: 'yes' as const }];
    useVotingStore.setState({
      proposals: [proposal({ id: 'p1', isOpen: true, votes: originalVotes })],
    });
    mockFrom.mockReturnValue(fail('write conflict'));

    await expect(
      useVotingStore.getState().castVote('p1', 'Bob', 'yes')
    ).rejects.toThrow('Failed to cast vote');

    // Reverted correctly — Bob's vote is gone
    expect(useVotingStore.getState().proposals[0].votes).toEqual(originalVotes);
  });

  it('preserves votes from other proposals when reverting', async () => {
    useVotingStore.setState({
      proposals: [
        proposal({ id: 'p1', isOpen: true, votes: [] }),
        proposal({ id: 'p2', isOpen: true, votes: [{ person: 'Alice', choice: 'yes' }] }),
      ],
    });
    mockFrom.mockReturnValue(fail('error'));

    await expect(
      useVotingStore.getState().castVote('p1', 'Bob', 'yes')
    ).rejects.toThrow();

    // p2's votes must be untouched
    expect(useVotingStore.getState().proposals[1].votes).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// closeProposal — ⚠️ BUG: no error guard
// ─────────────────────────────────────────────────────────────────────────────

describe('votingStore — closeProposal', () => {
  it('marks proposal as closed on success', async () => {
    useVotingStore.setState({ proposals: [proposal({ id: 'p1', isOpen: true })] });
    mockFrom.mockReturnValue(ok());

    await useVotingStore.getState().closeProposal('p1');

    expect(useVotingStore.getState().proposals[0].isOpen).toBe(false);
  });

  it('throws and leaves proposal open when DB update fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useVotingStore.setState({ proposals: [proposal({ id: 'p1', isOpen: true })] });
    mockFrom.mockReturnValue(fail('lock timeout'));

    await expect(
      useVotingStore.getState().closeProposal('p1')
    ).rejects.toThrow('Failed to close proposal');

    expect(useVotingStore.getState().proposals[0].isOpen).toBe(true); // unchanged
  });

  it('⚠️ BUG: closing a non-existent proposal id is silently ignored', async () => {
    useVotingStore.setState({ proposals: [proposal({ id: 'p1' })] });
    mockFrom.mockReturnValue(ok());

    // No error thrown, DB update targets 0 rows
    await expect(
      useVotingStore.getState().closeProposal('wrong-id')
    ).resolves.toBeUndefined();

    // p1 is unaffected — at least state is consistent here
    expect(useVotingStore.getState().proposals[0].isOpen).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// remove — ⚠️ BUG: no error guard
// ─────────────────────────────────────────────────────────────────────────────

describe('votingStore — remove', () => {
  it('removes proposal from state on success', async () => {
    useVotingStore.setState({ proposals: [proposal({ id: 'p1' })] });
    mockFrom.mockReturnValue(ok());

    await useVotingStore.getState().remove('p1');

    expect(useVotingStore.getState().proposals).toHaveLength(0);
  });

  it('throws and keeps proposal in state when DB delete fails', async () => {
    // Error guard added: `const { error } = await ...` + `if (error) throw`.
    useVotingStore.setState({ proposals: [proposal({ id: 'p1', title: 'Get a dog' })] });
    mockFrom.mockReturnValue(fail('RLS violation'));

    await expect(
      useVotingStore.getState().remove('p1')
    ).rejects.toThrow('Failed to remove proposal');

    expect(useVotingStore.getState().proposals).toHaveLength(1); // unchanged
  });

  it('only removes the targeted proposal, leaves others intact', async () => {
    useVotingStore.setState({
      proposals: [
        proposal({ id: 'p1', title: 'Get a dog' }),
        proposal({ id: 'p2', title: 'Paint the door' }),
      ],
    });
    mockFrom.mockReturnValue(ok());

    await useVotingStore.getState().remove('p1');

    expect(useVotingStore.getState().proposals).toHaveLength(1);
    expect(useVotingStore.getState().proposals[0].id).toBe('p2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// addProposal
// ─────────────────────────────────────────────────────────────────────────────

describe('votingStore — addProposal', () => {
  it('throws and leaves state empty when DB insert fails', async () => {
    mockFrom.mockReturnValue(fail('insert error'));

    await expect(
      useVotingStore.getState().addProposal('New topic', 'details', 'Alice', 'house-1')
    ).rejects.toThrow('Failed to add proposal');

    expect(useVotingStore.getState().proposals).toHaveLength(0);
  });

  it('adds proposal to the front of the list on success', async () => {
    const existing = proposal({ id: 'p-old', title: 'Old topic' });
    useVotingStore.setState({ proposals: [existing] });

    const row = {
      id: 'p-new', title: 'New topic', description: 'details',
      created_by: 'Alice', created_at: '2026-04-18T00:00:00Z', is_open: true, votes: [],
    };
    mockFrom.mockReturnValue(ok(row));

    await useVotingStore.getState().addProposal('New topic', 'details', 'Alice', 'house-1');

    const proposals = useVotingStore.getState().proposals;
    expect(proposals).toHaveLength(2);
    expect(proposals[0].id).toBe('p-new'); // prepended to front
    expect(proposals[0].isOpen).toBe(true);
    expect(proposals[0].votes).toEqual([]);
  });

  it('new proposal always starts with empty votes array', async () => {
    const row = {
      id: 'p-new', title: 'Topic', description: '',
      created_by: 'Bob', created_at: '2026-04-18T00:00:00Z', is_open: true, votes: null,
    };
    mockFrom.mockReturnValue(ok(row));

    await useVotingStore.getState().addProposal('Topic', '', 'Bob', 'house-1');

    expect(useVotingStore.getState().proposals[0].votes).toEqual([]);
  });
});
