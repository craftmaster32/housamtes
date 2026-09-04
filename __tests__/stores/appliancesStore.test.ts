/**
 * QA — appliancesStore
 *
 * Covers:
 *  1. remainingMs / isFinished — pure countdown logic
 *  2. start   — success sets the session; already-running guard; DB error reverts
 *  3. stop    — success clears the session; no-row no-op; DB error reverts
 *  4. addPreset — success appends; empty-name and out-of-range guards
 *  5. deletePreset — success removes; DB error restores
 */

import {
  remainingMs,
  isFinished,
  useAppliancesStore,
  type ApplianceSession,
} from '../../stores/appliancesStore';
import { ok, fail } from '../__helpers__/supabaseMock';
import { useAuthStore } from '../../stores/authStore';

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
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

const HOUSE = 'h1';

function session(overrides: Partial<ApplianceSession> = {}): ApplianceSession {
  return {
    id: 's1',
    appliance: 'washer',
    startedBy: 'u1',
    label: 'Eco',
    startedAt: '2026-09-04T10:00:00Z',
    endsAt: '2026-09-04T11:30:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  useAuthStore.setState({ houseId: HOUSE, profile: { id: 'u1', name: 'Alex' } as never });
  useAppliancesStore.setState({
    sessions: { washer: null, dryer: null, dishwasher: null },
    presets: [],
    isLoading: false,
    error: null,
  });
});

// ── 1. Pure helpers ─────────────────────────────────────────────────────────
describe('remainingMs / isFinished', () => {
  const now = new Date('2026-09-04T11:00:00Z');

  it('returns time left for a running cycle', () => {
    expect(remainingMs(session(), now)).toBe(30 * 60 * 1000);
    expect(isFinished(session(), now)).toBe(false);
  });

  it('clamps a past end time to zero and reads as finished', () => {
    const past = session({ endsAt: '2026-09-04T10:30:00Z' });
    expect(remainingMs(past, now)).toBe(0);
    expect(isFinished(past, now)).toBe(true);
  });

  it('treats a null session as 0 / not finished', () => {
    expect(remainingMs(null, now)).toBe(0);
    expect(isFinished(null, now)).toBe(false);
  });
});

// ── 2. start ────────────────────────────────────────────────────────────────
describe('start', () => {
  it('inserts a session and stores it', async () => {
    mockFrom.mockReturnValueOnce(
      ok({
        id: 's-new',
        appliance: 'washer',
        started_by: 'u1',
        label: 'Eco',
        started_at: '2026-09-04T10:00:00Z',
        ends_at: '2026-09-04T11:30:00Z',
      })
    );
    await useAppliancesStore.getState().start({
      appliance: 'washer',
      userId: 'u1',
      displayName: 'Alex',
      durationMinutes: 90,
      label: 'Eco',
      houseId: HOUSE,
    });
    expect(useAppliancesStore.getState().sessions.washer?.id).toBe('s-new');
  });

  it('refuses to start a machine that is already running', async () => {
    useAppliancesStore.setState({
      sessions: { washer: session(), dryer: null, dishwasher: null },
    });
    await expect(
      useAppliancesStore.getState().start({
        appliance: 'washer',
        userId: 'u1',
        displayName: 'Alex',
        durationMinutes: 60,
        label: '',
        houseId: HOUSE,
      })
    ).rejects.toThrow(/already running/);
  });

  it('reverts the optimistic session on a DB error', async () => {
    mockFrom.mockReturnValueOnce(fail('insert failed'));
    await expect(
      useAppliancesStore.getState().start({
        appliance: 'dryer',
        userId: 'u1',
        displayName: 'Alex',
        durationMinutes: 60,
        label: '',
        houseId: HOUSE,
      })
    ).rejects.toThrow(/Could not start/);
    expect(useAppliancesStore.getState().sessions.dryer).toBeNull();
  });
});

// ── 3. stop ─────────────────────────────────────────────────────────────────
describe('stop', () => {
  it('clears the session when a row is updated', async () => {
    useAppliancesStore.setState({
      sessions: { washer: session(), dryer: null, dishwasher: null },
    });
    mockFrom.mockReturnValueOnce(ok([{ id: 's1' }]));
    await useAppliancesStore.getState().stop('washer', HOUSE, 'Alex');
    expect(useAppliancesStore.getState().sessions.washer).toBeNull();
  });

  it('stays free when no row was updated (already closed elsewhere)', async () => {
    useAppliancesStore.setState({
      sessions: { washer: session(), dryer: null, dishwasher: null },
    });
    mockFrom.mockReturnValueOnce(ok([]));
    await useAppliancesStore.getState().stop('washer', HOUSE, 'Alex');
    expect(useAppliancesStore.getState().sessions.washer).toBeNull();
  });

  it('restores the session on a DB error', async () => {
    const s = session();
    useAppliancesStore.setState({ sessions: { washer: s, dryer: null, dishwasher: null } });
    mockFrom.mockReturnValueOnce(fail('update failed'));
    await expect(useAppliancesStore.getState().stop('washer', HOUSE, 'Alex')).rejects.toThrow(
      /Could not stop/
    );
    expect(useAppliancesStore.getState().sessions.washer).toEqual(s);
  });
});

// ── 4. addPreset ──────────────────────────────────────────────────────────────
describe('addPreset', () => {
  it('appends a saved preset on success', async () => {
    mockFrom.mockReturnValueOnce(
      ok({ id: 'p1', appliance: 'washer', name: 'Eco', duration_minutes: 150, created_by: 'u1' })
    );
    await useAppliancesStore.getState().addPreset({
      appliance: 'washer',
      name: 'Eco',
      durationMinutes: 150,
      userId: 'u1',
      houseId: HOUSE,
    });
    expect(useAppliancesStore.getState().presets).toHaveLength(1);
    expect(useAppliancesStore.getState().presets[0].name).toBe('Eco');
  });

  it('rejects an empty name', async () => {
    await expect(
      useAppliancesStore.getState().addPreset({
        appliance: 'washer',
        name: '   ',
        durationMinutes: 60,
        userId: 'u1',
        houseId: HOUSE,
      })
    ).rejects.toThrow(/name/);
  });

  it('rejects an out-of-range duration', async () => {
    await expect(
      useAppliancesStore.getState().addPreset({
        appliance: 'washer',
        name: 'Marathon',
        durationMinutes: 5000,
        userId: 'u1',
        houseId: HOUSE,
      })
    ).rejects.toThrow(/between/);
  });
});

// ── 5. deletePreset ───────────────────────────────────────────────────────────
describe('deletePreset', () => {
  it('removes the preset on success', async () => {
    useAppliancesStore.setState({
      presets: [
        { id: 'p1', appliance: 'washer', name: 'Eco', durationMinutes: 150, createdBy: 'u1' },
      ],
    });
    mockFrom.mockReturnValueOnce(ok(null));
    await useAppliancesStore.getState().deletePreset('p1');
    expect(useAppliancesStore.getState().presets).toHaveLength(0);
  });

  it('restores the preset on a DB error', async () => {
    const preset = {
      id: 'p1',
      appliance: 'washer' as const,
      name: 'Eco',
      durationMinutes: 150,
      createdBy: 'u1',
    };
    useAppliancesStore.setState({ presets: [preset] });
    mockFrom.mockReturnValueOnce(fail('delete failed'));
    await expect(useAppliancesStore.getState().deletePreset('p1')).rejects.toThrow(
      /Could not delete/
    );
    expect(useAppliancesStore.getState().presets).toEqual([preset]);
  });
});
