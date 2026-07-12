/**
 * QA — announcementsStore (house notice board, FEATURES.md 4.5)
 *
 * The notice board stores notes as pinned announcements. Locked-in behaviour:
 *  - post validates input (Zod), pins the note, and never commits state on
 *    DB failure
 *  - the board caps at MAX_NOTES — pinning past the cap auto-archives the
 *    oldest note (is_pinned=false) instead of deleting it
 *  - edit and remove keep local state consistent with the DB result
 */

import {
  useAnnouncementsStore,
  MAX_NOTES,
  type Announcement,
} from '../../stores/announcementsStore';
import { useAuthStore } from '../../stores/authStore';
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

const ME = 'user-me';
const HOUSE = 'house-1';

function note(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'n1',
    author: ME,
    text: 'WiFi password: sunflower42',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

function noteRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'n-new',
    author: ME,
    text: 'Bin day is Tuesday',
    is_pinned: true,
    created_at: '2026-07-11T00:00:00Z',
    updated_at: '2026-07-11T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  useAnnouncementsStore.setState({ items: [], isLoading: false, error: null });
  useAuthStore.setState({
    houseId: HOUSE,
  } as unknown as Partial<ReturnType<typeof useAuthStore.getState>>);
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// post
// ─────────────────────────────────────────────────────────────────────────────

describe('announcementsStore — post', () => {
  it('rejects an empty note before touching the database (Zod)', async () => {
    await expect(useAnnouncementsStore.getState().post('   ', ME, HOUSE)).rejects.toThrow();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(useAnnouncementsStore.getState().items).toHaveLength(0);
  });

  it('pins the note (is_pinned=true) and adds it newest-first on success', async () => {
    useAnnouncementsStore.setState({ items: [note({ id: 'older' })] });
    const chain = ok(noteRow());
    mockFrom.mockReturnValue(chain);

    await useAnnouncementsStore.getState().post('Bin day is Tuesday', ME, HOUSE);

    const items = useAnnouncementsStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('n-new');
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ is_pinned: true }));
  });

  it('throws and does NOT add to state when DB insert fails', async () => {
    mockFrom.mockReturnValue(fail('RLS denied'));

    await expect(
      useAnnouncementsStore.getState().post('Bin day is Tuesday', ME, HOUSE)
    ).rejects.toThrow('Could not pin the note. Please try again.');

    expect(useAnnouncementsStore.getState().items).toHaveLength(0);
  });

  it(`caps the board at ${MAX_NOTES} notes and auto-archives the oldest`, async () => {
    // Board is already full: MAX_NOTES notes, oldest last.
    const full = Array.from({ length: MAX_NOTES }, (_, i) =>
      note({ id: `n${i}`, createdAt: `2026-06-${String(30 - i).padStart(2, '0')}T00:00:00Z` })
    );
    useAnnouncementsStore.setState({ items: full });

    const insertChain = ok(noteRow({ id: 'n-new' }));
    const archiveChain = ok();
    mockFrom.mockReturnValueOnce(insertChain).mockReturnValueOnce(archiveChain);

    await useAnnouncementsStore.getState().post('Bin day is Tuesday', ME, HOUSE);

    const items = useAnnouncementsStore.getState().items;
    expect(items).toHaveLength(MAX_NOTES); // still capped
    expect(items[0].id).toBe('n-new'); // newest kept
    expect(items.some((n) => n.id === `n${MAX_NOTES - 1}`)).toBe(false); // oldest dropped
    // The dropped note was archived (is_pinned=false), not deleted.
    expect(archiveChain.update).toHaveBeenCalledWith({ is_pinned: false });
    expect(archiveChain.in).toHaveBeenCalledWith('id', [`n${MAX_NOTES - 1}`]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// edit
// ─────────────────────────────────────────────────────────────────────────────

describe('announcementsStore — edit', () => {
  it('rejects an empty edit before touching the database (Zod)', async () => {
    useAnnouncementsStore.setState({ items: [note({ id: 'n1' })] });

    await expect(useAnnouncementsStore.getState().edit('n1', '  ')).rejects.toThrow();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(useAnnouncementsStore.getState().items[0].text).toBe('WiFi password: sunflower42');
  });

  it('updates the note text in state on success', async () => {
    useAnnouncementsStore.setState({ items: [note({ id: 'n1' })] });
    mockFrom.mockReturnValue(ok());

    await useAnnouncementsStore.getState().edit('n1', 'WiFi password: tulip99');

    const updated = useAnnouncementsStore.getState().items[0];
    expect(updated.text).toBe('WiFi password: tulip99');
    expect(updated.updatedAt).not.toBe(updated.createdAt); // marked as edited
  });

  it('throws and leaves the note unchanged when DB update fails', async () => {
    useAnnouncementsStore.setState({ items: [note({ id: 'n1' })] });
    mockFrom.mockReturnValue(fail('write failed'));

    await expect(
      useAnnouncementsStore.getState().edit('n1', 'WiFi password: tulip99')
    ).rejects.toThrow('Could not save the note. Please try again.');

    expect(useAnnouncementsStore.getState().items[0].text).toBe('WiFi password: sunflower42');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// remove
// ─────────────────────────────────────────────────────────────────────────────

describe('announcementsStore — remove', () => {
  it('removes the note from state on success', async () => {
    useAnnouncementsStore.setState({ items: [note({ id: 'n1' })] });
    mockFrom.mockReturnValue(ok());

    await useAnnouncementsStore.getState().remove('n1');

    expect(useAnnouncementsStore.getState().items).toHaveLength(0);
  });

  it('throws and keeps the note in state when DB delete fails', async () => {
    useAnnouncementsStore.setState({ items: [note({ id: 'n1' })] });
    mockFrom.mockReturnValue(fail('RLS denied'));

    await expect(useAnnouncementsStore.getState().remove('n1')).rejects.toThrow(
      'Could not delete the note. Please try again.'
    );

    expect(useAnnouncementsStore.getState().items).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// load
// ─────────────────────────────────────────────────────────────────────────────

describe('announcementsStore — load', () => {
  it('only loads pinned notes (the board never shows archived ones)', async () => {
    const chain = ok([noteRow({ id: 'n1' })]);
    mockFrom.mockReturnValue(chain);

    await useAnnouncementsStore.getState().load(HOUSE);

    expect(chain.eq).toHaveBeenCalledWith('is_pinned', true);
    expect(useAnnouncementsStore.getState().items).toHaveLength(1);
    expect(useAnnouncementsStore.getState().isLoading).toBe(false);
  });

  it('sets a plain-English error and stops loading when the query fails', async () => {
    mockFrom.mockReturnValue(fail('connection lost'));

    await useAnnouncementsStore.getState().load(HOUSE);

    expect(useAnnouncementsStore.getState().error).toBe(
      'Could not load the notice board. Please try again.'
    );
    expect(useAnnouncementsStore.getState().isLoading).toBe(false);
  });
});
