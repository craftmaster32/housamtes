/**
 * QA — housematesStore
 *
 * Locks in the error-state behaviour added for the release-readiness pass:
 * a failed load must surface a plain-English error (so the dashboard banner
 * can show it) instead of failing silently, and a successful load must clear it.
 */

import { useHousematesStore } from '../../stores/housematesStore';
import { ok } from '../__helpers__/supabaseMock';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    rpc: (...a: unknown[]): unknown => mockRpc(...a),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
    removeChannel: jest.fn(),
    storage: { from: jest.fn(() => ({ createSignedUrl: jest.fn() })) },
  },
}));

jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));

jest.mock('@stores/authStore', () => ({
  useAuthStore: { getState: (): { houseId: string } => ({ houseId: 'h1' }) },
}));

beforeEach(() => {
  useHousematesStore.setState({
    housemates: [],
    houseName: '',
    inviteCode: '',
    isSetup: false,
    isLoading: true,
    error: null,
  });
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: null, error: null });
});

describe('housematesStore — load error state', () => {
  it('sets a plain-English error when the load throws', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('network down');
    });

    await useHousematesStore.getState().load('h1');

    const s = useHousematesStore.getState();
    expect(s.error).toBe('Could not load your housemates. Please try again.');
    expect(s.isLoading).toBe(false);
    expect(s.isSetup).toBe(false);
  });

  it('clears the error on a successful load', async () => {
    useHousematesStore.setState({ error: 'Could not load your housemates. Please try again.' });
    mockFrom.mockImplementation((table: string) =>
      table === 'houses' ? ok({ name: 'Casa', invite_code: 'ABC123', timezone: 'UTC' }) : ok([])
    );

    await useHousematesStore.getState().load('h1');

    const s = useHousematesStore.getState();
    expect(s.error).toBeNull();
    expect(s.houseName).toBe('Casa');
    expect(s.isLoading).toBe(false);
  });

  it('clearError resets the error field', () => {
    useHousematesStore.setState({ error: 'boom' });

    useHousematesStore.getState().clearError();

    expect(useHousematesStore.getState().error).toBeNull();
  });

  it('does not set an error when aborting due to a house ID mismatch', async () => {
    await useHousematesStore.getState().load('other-house');

    const s = useHousematesStore.getState();
    expect(s.error).toBeNull();
    expect(s.isLoading).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('housematesStore — updateRole', () => {
  it('changes a role through the owner-safe RPC and updates local state', async () => {
    useHousematesStore.setState({
      housemates: [
        {
          id: 'u2',
          memberId: 'm2',
          name: 'Bob',
          color: '#222',
          role: 'member',
          permissions: {} as never,
          joinedAt: null,
        },
      ],
    });

    await useHousematesStore.getState().updateRole('m2', 'owner');

    expect(mockRpc).toHaveBeenCalledWith('set_member_role', {
      p_member_id: 'm2',
      p_role: 'owner',
    });
    expect(useHousematesStore.getState().housemates[0].role).toBe('owner');
  });

  it('throws a plain-English error and leaves state unchanged when the RPC fails', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error('The house must keep at least one owner'),
    });
    useHousematesStore.setState({
      housemates: [
        {
          id: 'u2',
          memberId: 'm2',
          name: 'Bob',
          color: '#222',
          role: 'admin',
          permissions: {} as never,
          joinedAt: null,
        },
      ],
    });

    await expect(useHousematesStore.getState().updateRole('m2', 'member')).rejects.toThrow(
      'Could not update role. Please try again.'
    );
    expect(useHousematesStore.getState().housemates[0].role).toBe('admin');
  });
});

describe('housematesStore — updatePermissions', () => {
  it('updates permissions through the RPC and updates local state', async () => {
    const perms = { bills: false } as never;
    useHousematesStore.setState({
      housemates: [
        {
          id: 'u2',
          memberId: 'm2',
          name: 'Bob',
          color: '#222',
          role: 'member',
          permissions: {} as never,
          joinedAt: null,
        },
      ],
    });

    await useHousematesStore.getState().updatePermissions('m2', perms);

    expect(mockRpc).toHaveBeenCalledWith('set_member_permissions', {
      p_member_id: 'm2',
      p_permissions: perms,
    });
    expect(useHousematesStore.getState().housemates[0].permissions).toBe(perms);
  });
});

describe('housematesStore — removeMember', () => {
  it('snapshots the removed member, drops their membership, and updates state', async () => {
    mockFrom.mockImplementation(() => ok(null));
    useHousematesStore.setState({
      housemates: [
        {
          id: 'u2',
          memberId: 'm2',
          name: 'Bob',
          color: '#222',
          role: 'member',
          permissions: {} as never,
          joinedAt: null,
        },
      ],
      formerMembers: [],
    });

    await useHousematesStore.getState().removeMember('h1', 'u2', 'Bob', '#222');

    expect(mockFrom).toHaveBeenCalledWith('former_members');
    expect(mockFrom).toHaveBeenCalledWith('house_members');
    const s = useHousematesStore.getState();
    expect(s.housemates.find((h) => h.id === 'u2')).toBeUndefined();
    expect(s.formerMembers).toEqual([
      expect.objectContaining({ id: 'u2', name: 'Bob', reason: 'removed' }),
    ]);
  });
});
