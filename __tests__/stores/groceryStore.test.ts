/**
 * QA — groceryStore
 *
 * Covers the exact scenarios that have broken in production before:
 *
 *  1. toggleItem    — optimistic update fires immediately; rollback on DB error
 *  2. clearChecked  — items disappear before Supabase responds; rollback on DB error
 *  3. deleteItem    — item removed immediately; rollback on DB error
 *  4. incrementBought / decrementBought — optimistic counter change + rollback
 *  5. Realtime INSERT  — adds item without duplicating if already present
 *  6. Realtime UPDATE  — patches only the changed item in place
 *  7. Realtime DELETE  — removes item from local state
 *
 * WHY THESE TESTS EXIST:
 *  - clearChecked raced against realtime reloads: items cleared then came back
 *  - Checking an item had a 200-500ms delay because state updated after Supabase
 *  - Fixing error-surfacing in clearChecked exposed the hidden race condition
 */

import { useGroceryStore, type GroceryItem, type GroceryList } from '../../stores/groceryStore';
import { notifyHousemates } from '@lib/notifyHousemates';
import { ok, fail } from '../__helpers__/supabaseMock';

// ── Realtime channel mock ─────────────────────────────────────────────────────

type PgHandler = (payload: {
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}) => void;

interface ChannelHandlers {
  insert?: PgHandler;
  update?: PgHandler;
  delete?: PgHandler;
}

let capturedHandlers: ChannelHandlers = {};

interface MockChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  send: jest.Mock;
}

const mockChannel: MockChannel = {
  on: jest.fn((_type: string, config: { event?: string }, handler: PgHandler): MockChannel => {
    if (config.event === 'INSERT') capturedHandlers.insert = handler;
    if (config.event === 'UPDATE') capturedHandlers.update = handler;
    if (config.event === 'DELETE') capturedHandlers.delete = handler;
    return mockChannel;
  }),
  subscribe: jest.fn((): MockChannel => mockChannel),
  send: jest.fn(),
};

const mockFrom = jest.fn();
const mockRpc = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    rpc: (...a: unknown[]): unknown => mockRpc(...a),
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    },
  },
}));

jest.mock('@stores/authStore', () => ({
  useAuthStore: {
    getState: (): { houseId: string; profile: { id: string } } => ({
      houseId: 'house-1',
      profile: { id: 'u-groc' },
    }),
  },
}));

jest.mock('@lib/notifyHousemates', () => ({
  notifyHousemates: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const HOUSE_UUID = '00000000-0000-0000-0000-000000000001';

// ── Helpers ───────────────────────────────────────────────────────────────────

function rawRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'item-1',
    name: 'Milk',
    quantity: '1',
    bought_count: 0,
    added_by: 'user-1',
    is_checked: false,
    created_at: '2026-01-01T00:00:00Z',
    is_personal: false,
    is_draft: false,
    comment: null,
    draft_expires_at: null,
    ...overrides,
  };
}

function item(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return {
    id: 'item-1',
    name: 'Milk',
    quantity: '1',
    boughtCount: 0,
    addedBy: 'user-1',
    isChecked: false,
    createdAt: '2026-01-01T00:00:00Z',
    isPersonal: false,
    isDraft: false,
    comment: undefined,
    draftExpiresAt: undefined,
    ...overrides,
  };
}

function seedItems(...overrides: Array<Partial<GroceryItem>>): void {
  useGroceryStore.setState({
    items: overrides.map((o, i) => item({ id: `item-${i + 1}`, name: `Item${i + 1}`, ...o })),
    isLoading: false,
    error: null,
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  useGroceryStore.setState({
    items: [],
    isLoading: false,
    error: null,
    activeRun: null,
    savedLists: [],
    isLoadingLists: false,
    currentDraftSourceListId: null,
    reminders: [],
    isLoadingReminders: false,
    remindersError: null,
  });
  // Drop the module-level channel so every test subscribes fresh — the store
  // now (correctly) keeps an existing channel across reloads for the same house.
  useGroceryStore.getState().unsubscribe();
  capturedHandlers = {};
  mockFrom.mockReset();
  mockRpc.mockReset();
  (notifyHousemates as jest.Mock).mockClear();
  mockChannel.on.mockClear();
  mockChannel.subscribe.mockClear();
});

// ── load wires up realtime handlers ──────────────────────────────────────────

describe('load', () => {
  it('subscribes and wires up INSERT / UPDATE / DELETE handlers', async () => {
    mockFrom.mockReturnValue(ok([]));
    await useGroceryStore.getState().load('house-1');
    expect(capturedHandlers.insert).toBeDefined();
    expect(capturedHandlers.update).toBeDefined();
    expect(capturedHandlers.delete).toBeDefined();
  });
});

// ── toggleItem ────────────────────────────────────────────────────────────────

describe('toggleItem', () => {
  it('updates UI immediately before Supabase responds', async () => {
    seedItems({ isChecked: false });
    mockFrom.mockReturnValue(ok(null));
    // Optimistic update fires synchronously before the awaited Supabase call,
    // so state is already updated when we check it before awaiting.
    const promise = useGroceryStore.getState().toggleItem('item-1');
    expect(useGroceryStore.getState().items[0].isChecked).toBe(true);
    await promise;
  });

  it('rolls back if Supabase returns an error', async () => {
    seedItems({ isChecked: false });
    mockFrom.mockReturnValue(fail('permission denied'));

    await useGroceryStore.getState().toggleItem('item-1');

    expect(useGroceryStore.getState().items[0].isChecked).toBe(false);
  });

  it('toggles from checked to unchecked', async () => {
    seedItems({ isChecked: true });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().toggleItem('item-1');

    expect(useGroceryStore.getState().items[0].isChecked).toBe(false);
  });

  it('does nothing if item id is not found', async () => {
    seedItems({});
    await useGroceryStore.getState().toggleItem('does-not-exist');
    expect(useGroceryStore.getState().items[0].isChecked).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ── updateItem ────────────────────────────────────────────────────────────────

describe('updateItem', () => {
  it('applies the new name/quantity and stamps who edited it', async () => {
    seedItems({ name: 'Milk', quantity: '1' });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().updateItem('item-1', 'Oat milk', '2');

    const updated = useGroceryStore.getState().items[0];
    expect(updated.name).toBe('Oat milk');
    expect(updated.quantity).toBe('2');
    // Stamped so the edit can surface as "edited a shopping item" in the bell.
    expect(updated.editedBy).toBe('u-groc');
    expect(typeof updated.editedAt).toBe('string');
  });

  it('leaves state unchanged when the DB update fails', async () => {
    seedItems({ name: 'Milk', quantity: '1' });
    mockFrom.mockReturnValue(fail('permission denied'));

    await expect(useGroceryStore.getState().updateItem('item-1', 'Oat milk', '2')).rejects.toThrow(
      'Could not update the item. Please try again.'
    );

    expect(useGroceryStore.getState().items[0].name).toBe('Milk');
    expect(useGroceryStore.getState().items[0].editedBy).toBeUndefined();
  });
});

// ── clearChecked ──────────────────────────────────────────────────────────────

describe('clearChecked', () => {
  it('removes checked items from UI immediately before Supabase responds', async () => {
    seedItems({ isChecked: true }, { isChecked: false }, { isChecked: true });
    mockFrom.mockReturnValue(ok(null));

    const promise = useGroceryStore.getState().clearChecked(HOUSE_UUID);

    // State updated synchronously before the await resolves
    expect(useGroceryStore.getState().items).toHaveLength(1);
    expect(useGroceryStore.getState().items[0].isChecked).toBe(false);
    await promise;
  });

  it('rolls back all items if Supabase returns an error', async () => {
    seedItems({ isChecked: true }, { isChecked: false });
    mockFrom.mockReturnValue(fail('connection error'));

    await expect(useGroceryStore.getState().clearChecked(HOUSE_UUID)).rejects.toThrow(
      'Could not clear checked items'
    );

    // Both items are back — no partial state left behind
    expect(useGroceryStore.getState().items).toHaveLength(2);
  });

  it('is a no-op when nothing is checked', async () => {
    seedItems({ isChecked: false });
    await useGroceryStore.getState().clearChecked(HOUSE_UUID);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(useGroceryStore.getState().items).toHaveLength(1);
  });

  it('clears checked items and leaves unchecked items', async () => {
    seedItems(
      { id: 'item-1', isChecked: true },
      { id: 'item-2', isChecked: false },
      { id: 'item-3', isChecked: true }
    );
    mockFrom.mockReturnValue(ok(null));
    await useGroceryStore.getState().clearChecked(HOUSE_UUID);

    const ids = useGroceryStore.getState().items.map((i) => i.id);
    expect(ids).toEqual(['item-2']);
  });

  it('re-removes checked items restored by a concurrent load before the delete landed', async () => {
    seedItems({ id: 'item-1', isChecked: true }, { id: 'item-2', isChecked: false });
    mockFrom.mockImplementation(() => {
      // Simulate loadGrocery overwriting state mid-flight (AppState active race)
      useGroceryStore.setState({
        items: [item({ id: 'item-1', isChecked: true }), item({ id: 'item-2', isChecked: false })],
      });
      return ok(null);
    });

    await useGroceryStore.getState().clearChecked(HOUSE_UUID);

    const ids = useGroceryStore.getState().items.map((i) => i.id);
    expect(ids).toEqual(['item-2']);
  });

  it('is a no-op when houseId is empty', async () => {
    seedItems({ isChecked: true });
    await useGroceryStore.getState().clearChecked('');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(useGroceryStore.getState().items).toHaveLength(1);
  });

  it('is a no-op when houseId is not a valid UUID', async () => {
    seedItems({ isChecked: true });
    await useGroceryStore.getState().clearChecked('not-a-valid-uuid');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(useGroceryStore.getState().items).toHaveLength(1);
  });
});

// ── deleteItem ────────────────────────────────────────────────────────────────

describe('deleteItem', () => {
  it('removes item from UI immediately', async () => {
    seedItems({}, { id: 'item-2', name: 'Bread' });
    mockFrom.mockReturnValue(ok(null));

    const promise = useGroceryStore.getState().deleteItem('item-1');

    expect(useGroceryStore.getState().items).toHaveLength(1);
    expect(useGroceryStore.getState().items[0].id).toBe('item-2');
    await promise;
  });

  it('rolls back if Supabase returns an error', async () => {
    seedItems({});
    mockFrom.mockReturnValue(fail('permission denied'));

    await expect(useGroceryStore.getState().deleteItem('item-1')).rejects.toThrow(
      'Could not delete the item'
    );

    expect(useGroceryStore.getState().items).toHaveLength(1);
  });
});

// ── incrementBought ───────────────────────────────────────────────────────────

describe('incrementBought', () => {
  it('increments counter immediately', async () => {
    seedItems({ quantity: '3', boughtCount: 0 });
    mockFrom.mockReturnValue(ok(null));

    const promise = useGroceryStore.getState().incrementBought('item-1');

    expect(useGroceryStore.getState().items[0].boughtCount).toBe(1);
    await promise;
  });

  it('marks as checked when count reaches max', async () => {
    seedItems({ quantity: '2', boughtCount: 1 });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().incrementBought('item-1');

    const i = useGroceryStore.getState().items[0];
    expect(i.boughtCount).toBe(2);
    expect(i.isChecked).toBe(true);
  });

  it('keeps the optimistic count immediately (DB write is debounced, not awaited)', async () => {
    seedItems({ quantity: '3', boughtCount: 1 });
    mockFrom.mockReturnValue(fail('error'));

    await useGroceryStore.getState().incrementBought('item-1');

    // The local count updates immediately; the write is deferred so it never
    // snaps the number back mid-interaction (resync only runs later, on failure).
    expect(useGroceryStore.getState().items[0].boughtCount).toBe(2);
  });

  it('resyncs from the server when the debounced write fails', async () => {
    jest.useFakeTimers();
    try {
      seedItems({ quantity: '3', boughtCount: 1 });
      // 1st from() = the failing UPDATE; 2nd = the resync SELECT (server truth).
      mockFrom.mockReturnValueOnce(fail('permission denied'));
      mockFrom.mockReturnValueOnce(ok({ bought_count: 1, is_checked: false }));

      await useGroceryStore.getState().incrementBought('item-1');
      expect(useGroceryStore.getState().items[0].boughtCount).toBe(2); // optimistic

      await jest.runAllTimersAsync(); // fire debounce → write fails → resync

      // Snaps back to the value that's actually on the server.
      expect(useGroceryStore.getState().items[0].boughtCount).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

// ── decrementBought ───────────────────────────────────────────────────────────

describe('decrementBought', () => {
  it('decrements counter immediately', async () => {
    seedItems({ quantity: '3', boughtCount: 2 });
    mockFrom.mockReturnValue(ok(null));

    const promise = useGroceryStore.getState().decrementBought('item-1');

    expect(useGroceryStore.getState().items[0].boughtCount).toBe(1);
    await promise;
  });

  it('does not go below zero', async () => {
    seedItems({ quantity: '3', boughtCount: 0 });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().decrementBought('item-1');

    expect(useGroceryStore.getState().items[0].boughtCount).toBe(0);
  });

  it('keeps the optimistic count (DB write is debounced, not awaited)', async () => {
    seedItems({ quantity: '3', boughtCount: 2 });
    mockFrom.mockReturnValue(fail('error'));

    await useGroceryStore.getState().decrementBought('item-1');

    // Local count updates immediately; the deferred write doesn't snap it back
    // mid-interaction (a failed write resyncs later, not right now).
    expect(useGroceryStore.getState().items[0].boughtCount).toBe(1);
  });
});

// ── setBoughtCount ─────────────────────────────────────────────────────────────

describe('setBoughtCount', () => {
  it('jumps straight to the full quantity and marks it checked', async () => {
    seedItems({ quantity: '3', boughtCount: 0, isChecked: false });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().setBoughtCount('item-1', 3);

    const i = useGroceryStore.getState().items[0];
    expect(i.boughtCount).toBe(3);
    expect(i.isChecked).toBe(true);
  });

  it('clears the count back to zero and unchecks', async () => {
    seedItems({ quantity: '3', boughtCount: 3, isChecked: true });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().setBoughtCount('item-1', 0);

    const i = useGroceryStore.getState().items[0];
    expect(i.boughtCount).toBe(0);
    expect(i.isChecked).toBe(false);
  });

  it('clamps a value above the max down to the max', async () => {
    seedItems({ quantity: '2', boughtCount: 0, isChecked: false });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().setBoughtCount('item-1', 9);

    expect(useGroceryStore.getState().items[0].boughtCount).toBe(2);
  });

  it('ignores junk values (NaN, fractional, negative) without changing state', async () => {
    seedItems({ quantity: '3', boughtCount: 1, isChecked: false });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().setBoughtCount('item-1', NaN);
    await useGroceryStore.getState().setBoughtCount('item-1', 1.5);
    await useGroceryStore.getState().setBoughtCount('item-1', -2);

    expect(useGroceryStore.getState().items[0].boughtCount).toBe(1);
  });
});

// ── Realtime: INSERT handler ───────────────────────────────────────────────────

describe('realtime INSERT handler', () => {
  beforeEach(async () => {
    mockFrom.mockReturnValue(ok([]));
    await useGroceryStore.getState().load('house-1');
  });

  it('adds a new item to local state', () => {
    capturedHandlers.insert!({ new: rawRow({ id: 'item-new', name: 'Eggs' }) });
    const items = useGroceryStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('item-new');
    expect(items[0].name).toBe('Eggs');
  });

  it('does not add a duplicate if the item is already present', () => {
    useGroceryStore.setState({ items: [item({ id: 'item-1' })] });
    capturedHandlers.insert!({ new: rawRow({ id: 'item-1' }) });
    expect(useGroceryStore.getState().items).toHaveLength(1);
  });
});

// ── Realtime: UPDATE handler ──────────────────────────────────────────────────

describe('realtime UPDATE handler', () => {
  beforeEach(async () => {
    mockFrom.mockReturnValue(ok([]));
    await useGroceryStore.getState().load('house-1');
    useGroceryStore.setState({ items: [item({ id: 'item-1', isChecked: false })] });
  });

  it('patches the changed item in place', () => {
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', is_checked: true }) });
    const updated = useGroceryStore.getState().items[0];
    expect(updated.isChecked).toBe(true);
  });

  it('leaves other items unchanged', () => {
    useGroceryStore.setState({
      items: [item({ id: 'item-1', name: 'Milk' }), item({ id: 'item-2', name: 'Bread' })],
    });
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', name: 'Oat Milk' }) });
    const items = useGroceryStore.getState().items;
    expect(items[0].name).toBe('Oat Milk');
    expect(items[1].name).toBe('Bread');
  });

  // Regression: the debounce collapses rapid taps into one write, but if you tap
  // again after that write fires and before its echo returns, a stale echo could
  // still snap the counter backwards. The pending-count guard closes that window.
  it('does not let a stale self-echo revert a fresher local count', async () => {
    useGroceryStore.setState({ items: [item({ id: 'item-1', quantity: '5', boughtCount: 0 })] });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().incrementBought('item-1');
    await useGroceryStore.getState().incrementBought('item-1');
    expect(useGroceryStore.getState().items[0].boughtCount).toBe(2);

    // Echo of the FIRST write (count 1) arrives late — must not revert to 1.
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', quantity: '5', bought_count: 1 }) });
    expect(useGroceryStore.getState().items[0].boughtCount).toBe(2);
  });

  it('applies the echo once it catches up to the latest write', async () => {
    useGroceryStore.setState({ items: [item({ id: 'item-1', quantity: '5', boughtCount: 0 })] });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().incrementBought('item-1');
    await useGroceryStore.getState().incrementBought('item-1');

    // Echo of the latest write (count 2) lands — guard clears, row applied.
    capturedHandlers.update!({
      new: rawRow({ id: 'item-1', quantity: '5', bought_count: 2, name: 'Oat Milk' }),
    });
    const updated = useGroceryStore.getState().items[0];
    expect(updated.boughtCount).toBe(2);
    expect(updated.name).toBe('Oat Milk');

    // A later remote change now flows through normally (guard was cleared).
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', quantity: '5', bought_count: 3 }) });
    expect(useGroceryStore.getState().items[0].boughtCount).toBe(3);
  });

  it("still applies a stale echo's other fields while guarding the count", async () => {
    useGroceryStore.setState({ items: [item({ id: 'item-1', quantity: '5', boughtCount: 0 })] });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().incrementBought('item-1');
    await useGroceryStore.getState().incrementBought('item-1');

    // Stale echo (count 1) also carries a name change from another user.
    capturedHandlers.update!({
      new: rawRow({ id: 'item-1', quantity: '5', bought_count: 1, name: 'Whole Milk' }),
    });
    const updated = useGroceryStore.getState().items[0];
    expect(updated.boughtCount).toBe(2); // count preserved
    expect(updated.name).toBe('Whole Milk'); // other fields merged
  });

  // Regression: regular (checkbox) items had the same self-echo problem — a stale
  // echo could flip the checkbox back, so a tap read as laggy/unresponsive.
  it('does not let a stale self-echo revert a freshly toggled checkbox', async () => {
    useGroceryStore.setState({ items: [item({ id: 'item-1', isChecked: false })] });
    mockFrom.mockReturnValue(ok(null));

    // Check it, then uncheck it — local state ends unchecked.
    await useGroceryStore.getState().toggleItem('item-1');
    await useGroceryStore.getState().toggleItem('item-1');
    expect(useGroceryStore.getState().items[0].isChecked).toBe(false);

    // Echo of the FIRST write (checked) arrives late — must not re-check it.
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', is_checked: true }) });
    expect(useGroceryStore.getState().items[0].isChecked).toBe(false);
  });

  it('applies the checkbox echo once it catches up, then resumes remote updates', async () => {
    useGroceryStore.setState({ items: [item({ id: 'item-1', isChecked: false })] });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().toggleItem('item-1'); // -> checked

    // Echo of that write lands — guard clears, other fields merge.
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', is_checked: true, name: 'Oat Milk' }) });
    expect(useGroceryStore.getState().items[0].isChecked).toBe(true);
    expect(useGroceryStore.getState().items[0].name).toBe('Oat Milk');

    // A later remote uncheck (e.g. a housemate) now flows through normally.
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', is_checked: false }) });
    expect(useGroceryStore.getState().items[0].isChecked).toBe(false);
  });
});

// ── Realtime: DELETE handler ──────────────────────────────────────────────────

describe('realtime DELETE handler', () => {
  beforeEach(async () => {
    mockFrom.mockReturnValue(ok([]));
    await useGroceryStore.getState().load('house-1');
    useGroceryStore.setState({
      items: [item({ id: 'item-1' }), item({ id: 'item-2', name: 'Bread' })],
    });
  });

  it('removes the deleted item', () => {
    capturedHandlers.delete!({ old: { id: 'item-1' } });
    const ids = useGroceryStore.getState().items.map((i) => i.id);
    expect(ids).toEqual(['item-2']);
  });

  it('is a no-op if id is missing from payload', () => {
    capturedHandlers.delete!({ old: {} });
    expect(useGroceryStore.getState().items).toHaveLength(2);
  });
});

// ── The race condition that broke clearChecked ────────────────────────────────

describe('clearChecked + realtime race condition', () => {
  it('a realtime DELETE event after a clear does not restore cleared items', async () => {
    await (async (): Promise<void> => {
      mockFrom.mockReturnValue(ok([]));
      await useGroceryStore.getState().load('house-1');
    })();

    useGroceryStore.setState({
      items: [item({ id: 'item-1', isChecked: true }), item({ id: 'item-2', isChecked: false })],
    });

    mockFrom.mockReturnValue(ok(null));
    await useGroceryStore.getState().clearChecked(HOUSE_UUID);

    // Simulate realtime DELETE event arriving after the clear
    capturedHandlers.delete!({ old: { id: 'item-1' } });

    // item-1 is gone, item-2 still there — not restored by realtime
    const ids = useGroceryStore.getState().items.map((i) => i.id);
    expect(ids).toEqual(['item-2']);
  });

  // Regression: a cleared item flashed back at the top and stayed. A late INSERT
  // echo (in flight when the item was added) re-added the just-deleted row, then a
  // late UPDATE echo re-checked it. The delete tombstone must block both.
  it('a late INSERT echo does not resurrect a just-cleared item', async () => {
    mockFrom.mockReturnValue(ok([]));
    await useGroceryStore.getState().load('house-1');
    useGroceryStore.setState({ items: [item({ id: 'item-1', isChecked: true })] });

    mockFrom.mockReturnValue(ok(null));
    await useGroceryStore.getState().clearChecked(HOUSE_UUID);
    expect(useGroceryStore.getState().items).toHaveLength(0);

    // Late INSERT echo for the same row arrives — must be ignored, not prepended.
    capturedHandlers.insert!({ new: rawRow({ id: 'item-1', is_checked: false }) });
    expect(useGroceryStore.getState().items).toHaveLength(0);

    // And a late UPDATE echo for it can't revive/re-check it either.
    capturedHandlers.update!({ new: rawRow({ id: 'item-1', is_checked: true }) });
    expect(useGroceryStore.getState().items).toHaveLength(0);
  });

  it('a late INSERT echo does not resurrect a deleted item', async () => {
    mockFrom.mockReturnValue(ok([]));
    await useGroceryStore.getState().load('house-1');
    useGroceryStore.setState({ items: [item({ id: 'item-1' })] });

    mockFrom.mockReturnValue(ok(null));
    await useGroceryStore.getState().deleteItem('item-1');

    capturedHandlers.insert!({ new: rawRow({ id: 'item-1' }) });
    expect(useGroceryStore.getState().items).toHaveLength(0);
  });

  it('a genuinely new item (different id) is still added after a clear', async () => {
    mockFrom.mockReturnValue(ok([]));
    await useGroceryStore.getState().load('house-1');
    useGroceryStore.setState({ items: [item({ id: 'item-1', isChecked: true })] });

    mockFrom.mockReturnValue(ok(null));
    await useGroceryStore.getState().clearChecked(HOUSE_UUID);

    // A fresh add uses a new id — the tombstone must not block it.
    capturedHandlers.insert!({ new: rawRow({ id: 'item-2', name: 'Eggs' }) });
    const ids = useGroceryStore.getState().items.map((i) => i.id);
    expect(ids).toEqual(['item-2']);
  });
});

// ── Reminders ───────────────────────────────────────────────────────────────

const USER_UUID = '00000000-0000-0000-0000-000000000002';
const LIST_UUID = '00000000-0000-0000-0000-000000000003';
const REMINDER_UUID = '00000000-0000-0000-0000-000000000004';
const REMINDER_UUID_2 = '00000000-0000-0000-0000-000000000005';

function reminderRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: REMINDER_UUID,
    house_id: HOUSE_UUID,
    user_id: USER_UUID,
    list_id: null,
    label: 'Buy milk',
    remind_at: '2099-01-01T10:00:00.000Z',
    sent: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('fetchReminders', () => {
  it('loads and maps reminders sorted by remind_at, querying with ascending order', async () => {
    const chain = ok([
      reminderRow({ id: REMINDER_UUID, remind_at: '2099-01-01T09:00:00.000Z' }),
      reminderRow({ id: REMINDER_UUID_2, remind_at: '2099-01-02T09:00:00.000Z' }),
    ]);
    mockFrom.mockReturnValue(chain);

    await useGroceryStore.getState().fetchReminders(HOUSE_UUID, USER_UUID);

    expect(chain.order).toHaveBeenCalledWith('remind_at', { ascending: true });
    const reminders = useGroceryStore.getState().reminders;
    expect(reminders.map((r) => r.id)).toEqual([REMINDER_UUID, REMINDER_UUID_2]);
    expect(reminders[0]).toMatchObject({
      id: REMINDER_UUID,
      houseId: HOUSE_UUID,
      userId: USER_UUID,
      listId: null,
      label: 'Buy milk',
    });
    expect(useGroceryStore.getState().remindersError).toBeNull();
  });

  it('surfaces an error when the fetch fails', async () => {
    mockFrom.mockReturnValue(fail('permission denied'));

    await useGroceryStore.getState().fetchReminders(HOUSE_UUID, USER_UUID);

    expect(useGroceryStore.getState().remindersError).toBe(
      'Could not load reminders. Please try again.'
    );
  });
});

describe('createReminder validation', () => {
  it('rejects a non-UUID houseId', async () => {
    await expect(
      useGroceryStore.getState().createReminder({
        houseId: 'not-a-uuid',
        userId: USER_UUID,
        listId: null,
        label: 'Buy milk',
        remindAt: '2099-01-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });

  it('rejects a non-UUID userId', async () => {
    await expect(
      useGroceryStore.getState().createReminder({
        houseId: HOUSE_UUID,
        userId: 'not-a-uuid',
        listId: null,
        label: 'Buy milk',
        remindAt: '2099-01-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });

  it('rejects an empty label', async () => {
    await expect(
      useGroceryStore.getState().createReminder({
        houseId: HOUSE_UUID,
        userId: USER_UUID,
        listId: null,
        label: '   ',
        remindAt: '2099-01-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });

  it('rejects a label longer than 200 characters', async () => {
    await expect(
      useGroceryStore.getState().createReminder({
        houseId: HOUSE_UUID,
        userId: USER_UUID,
        listId: null,
        label: 'a'.repeat(201),
        remindAt: '2099-01-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });

  it('rejects a non-ISO remindAt string', async () => {
    await expect(
      useGroceryStore.getState().createReminder({
        houseId: HOUSE_UUID,
        userId: USER_UUID,
        listId: null,
        label: 'Buy milk',
        remindAt: 'next tuesday',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });

  it('rejects a non-UUID listId', async () => {
    await expect(
      useGroceryStore.getState().createReminder({
        houseId: HOUSE_UUID,
        userId: USER_UUID,
        listId: 'not-a-uuid',
        label: 'Buy milk',
        remindAt: '2099-01-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });
});

describe('createReminder', () => {
  it('rejects a reminder time in the past', async () => {
    await expect(
      useGroceryStore.getState().createReminder({
        houseId: HOUSE_UUID,
        userId: USER_UUID,
        listId: null,
        label: 'Buy milk',
        remindAt: '2020-01-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });

  it('adds the new reminder to state on success', async () => {
    mockFrom.mockReturnValue(ok(reminderRow({ id: REMINDER_UUID_2, list_id: LIST_UUID })));

    await useGroceryStore.getState().createReminder({
      houseId: HOUSE_UUID,
      userId: USER_UUID,
      listId: LIST_UUID,
      label: 'Buy milk',
      remindAt: '2099-01-01T10:00:00.000Z',
    });

    const reminders = useGroceryStore.getState().reminders;
    expect(reminders).toHaveLength(1);
    expect(reminders[0].listId).toBe(LIST_UUID);
  });

  it('throws a friendly error when Supabase rejects the insert', async () => {
    mockFrom.mockReturnValue(fail('permission denied'));

    await expect(
      useGroceryStore.getState().createReminder({
        houseId: HOUSE_UUID,
        userId: USER_UUID,
        listId: null,
        label: 'Buy milk',
        remindAt: '2099-01-01T10:00:00.000Z',
      })
    ).rejects.toThrow('Could not set the reminder. Please try again.');
  });
});

describe('deleteReminder', () => {
  it('removes the reminder immediately, before Supabase responds', async () => {
    useGroceryStore.setState({
      reminders: [
        {
          id: REMINDER_UUID,
          houseId: HOUSE_UUID,
          userId: USER_UUID,
          listId: null,
          label: 'Buy milk',
          remindAt: '2099-01-01T10:00:00.000Z',
          sent: false,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });
    mockFrom.mockReturnValue(ok(null));

    const promise = useGroceryStore.getState().deleteReminder(REMINDER_UUID);
    expect(useGroceryStore.getState().reminders).toHaveLength(0);
    await promise;
  });

  it('rolls back if Supabase returns an error', async () => {
    const seeded = [
      {
        id: REMINDER_UUID,
        houseId: HOUSE_UUID,
        userId: USER_UUID,
        listId: null,
        label: 'Buy milk',
        remindAt: '2099-01-01T10:00:00.000Z',
        sent: false,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    useGroceryStore.setState({ reminders: seeded });
    mockFrom.mockReturnValue(fail('permission denied'));

    await expect(useGroceryStore.getState().deleteReminder(REMINDER_UUID)).rejects.toThrow(
      'Could not remove the reminder. Please try again.'
    );

    expect(useGroceryStore.getState().reminders).toEqual(seeded);
  });
});

// ── createSavedList — direct "New list" creation, private vs shared ──────────
describe('createSavedList', (): void => {
  const LIST_UUID = '00000000-0000-0000-0000-0000000000aa';

  function rpcList(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: LIST_UUID,
      house_id: HOUSE_UUID,
      name: 'Weekly Shop',
      created_by: USER_UUID,
      is_private: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      ...overrides,
    };
  }

  it('creates a private list from scratch and keeps it private (no housemate push)', async (): Promise<void> => {
    mockRpc.mockResolvedValue({
      data: rpcList({ is_private: true, name: 'Secret Snacks' }),
      error: null,
    });

    await useGroceryStore
      .getState()
      .createSavedList('Secret Snacks', HOUSE_UUID, USER_UUID, [], true, 'Alex');

    expect(mockRpc).toHaveBeenCalledWith(
      'create_grocery_list',
      expect.objectContaining({ p_is_private: true, p_name: 'Secret Snacks' })
    );
    // A private list must never notify the rest of the house.
    expect(notifyHousemates).not.toHaveBeenCalled();
    // The new (empty) list is prepended to savedLists.
    expect(useGroceryStore.getState().savedLists[0]).toMatchObject({
      id: LIST_UUID,
      name: 'Secret Snacks',
      isPrivate: true,
      items: [],
    });
  });

  it('notifies housemates when the new list is shared (not private)', async (): Promise<void> => {
    mockRpc.mockResolvedValue({ data: rpcList(), error: null });

    await useGroceryStore
      .getState()
      .createSavedList(
        'Weekly Shop',
        HOUSE_UUID,
        USER_UUID,
        [{ name: 'Milk', quantity: '1' }],
        false,
        'Alex'
      );

    expect(notifyHousemates).toHaveBeenCalledTimes(1);
    expect(useGroceryStore.getState().savedLists[0]).toMatchObject({
      name: 'Weekly Shop',
      isPrivate: false,
    });
  });

  it('surfaces a friendly error when the RPC fails', async (): Promise<void> => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(
      useGroceryStore.getState().createSavedList('X', HOUSE_UUID, USER_UUID, [], true, '')
    ).rejects.toThrow('Could not save the list. Please try again.');
    expect(notifyHousemates).not.toHaveBeenCalled();
  });
});

// ── updateSavedList — editing name, privacy and items of a saved list ────────
describe('updateSavedList', (): void => {
  const LIST_UUID = '00000000-0000-0000-0000-0000000000bb';

  function seedList(overrides: Partial<GroceryList> = {}): void {
    useGroceryStore.setState({
      savedLists: [
        {
          id: LIST_UUID,
          houseId: HOUSE_UUID,
          name: 'Old name',
          createdBy: USER_UUID,
          isPrivate: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          items: [{ id: 'x', listId: LIST_UUID, name: 'Milk', quantity: '1', position: 0 }],
          ...overrides,
        },
      ],
    });
  }

  function rpcRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: LIST_UUID,
      house_id: HOUSE_UUID,
      name: 'Old name',
      created_by: USER_UUID,
      is_private: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-02-02T00:00:00Z',
      ...overrides,
    };
  }

  it('rewrites the name, privacy flag and items in local state', async (): Promise<void> => {
    seedList();
    mockRpc.mockResolvedValue({
      data: rpcRow({ name: 'Weekly shop', is_private: true }),
      error: null,
    });

    await useGroceryStore
      .getState()
      .updateSavedList(LIST_UUID, [{ name: 'Eggs', quantity: '12' }], {
        name: 'Weekly shop',
        isPrivate: true,
      });

    // One atomic RPC carries items + metadata together.
    expect(mockRpc).toHaveBeenCalledWith(
      'update_grocery_list',
      expect.objectContaining({ p_list_id: LIST_UUID, p_name: 'Weekly shop', p_is_private: true })
    );
    const list = useGroceryStore.getState().savedLists[0];
    expect(list.name).toBe('Weekly shop');
    expect(list.isPrivate).toBe(true);
    expect(list.items.map((i) => i.name)).toEqual(['Eggs']);
  });

  it('rejects a blank name and never touches the database', async (): Promise<void> => {
    seedList();

    await expect(
      useGroceryStore.getState().updateSavedList(LIST_UUID, [], { name: '   ' })
    ).rejects.toThrow('Could not update the list. Please try again.');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(useGroceryStore.getState().savedLists[0].name).toBe('Old name');
  });

  it('saves an item-only edit without changing name or privacy', async (): Promise<void> => {
    seedList({ isPrivate: true, name: 'Keep me' });
    // Item-only edit passes null metadata; the RPC returns the unchanged row.
    mockRpc.mockResolvedValue({
      data: rpcRow({ name: 'Keep me', is_private: true }),
      error: null,
    });

    await useGroceryStore.getState().updateSavedList(LIST_UUID, [{ name: 'Bread', quantity: '' }]);

    expect(mockRpc).toHaveBeenCalledWith(
      'update_grocery_list',
      expect.objectContaining({ p_list_id: LIST_UUID, p_name: null, p_is_private: null })
    );
    const list = useGroceryStore.getState().savedLists[0];
    expect(list.name).toBe('Keep me');
    expect(list.isPrivate).toBe(true);
    expect(list.items.map((i) => i.name)).toEqual(['Bread']);
  });
});

// ── keepDraftPrivate — finishing a draft privately instead of sharing ────────
describe('keepDraftPrivate', () => {
  it('turns my draft items private, leaves other users alone, no notify', async (): Promise<void> => {
    useGroceryStore.setState({
      items: [
        item({ id: 'd1', isDraft: true, isPersonal: true, addedBy: USER_UUID }),
        item({ id: 'd2', isDraft: true, isPersonal: true, addedBy: USER_UUID }),
        item({ id: 'other', isDraft: true, isPersonal: true, addedBy: 'someone-else' }),
      ],
    });
    mockFrom.mockReturnValue(ok(null));

    await useGroceryStore.getState().keepDraftPrivate(USER_UUID, HOUSE_UUID);

    const mine = useGroceryStore.getState().items.filter((i) => i.addedBy === USER_UUID);
    // My drafts are now private (not shared) and no longer drafts.
    expect(mine.every((i) => i.isPersonal && !i.isDraft)).toBe(true);
    // Another user's draft is untouched.
    const other = useGroceryStore.getState().items.find((i) => i.id === 'other')!;
    expect(other.isPersonal).toBe(true);
    expect(other.isDraft).toBe(true);
    // Nothing gets pushed to the house — that's the whole point.
    expect(notifyHousemates).not.toHaveBeenCalled();
  });

  it('does nothing when there are no draft items to convert', async (): Promise<void> => {
    useGroceryStore.setState({
      items: [item({ id: 's1', isDraft: false, isPersonal: false, addedBy: USER_UUID })],
    });

    await useGroceryStore.getState().keepDraftPrivate(USER_UUID, HOUSE_UUID);

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
