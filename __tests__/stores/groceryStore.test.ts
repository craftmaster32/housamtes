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

import { useGroceryStore, type GroceryItem } from '../../stores/groceryStore';
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

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
    channel: jest.fn(() => mockChannel),
    removeChannel: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
    },
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
  });
  capturedHandlers = {};
  mockFrom.mockReset();
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

  it('rolls back counter on DB error', async () => {
    seedItems({ quantity: '3', boughtCount: 1 });
    mockFrom.mockReturnValue(fail('error'));

    await useGroceryStore.getState().incrementBought('item-1');

    expect(useGroceryStore.getState().items[0].boughtCount).toBe(1);
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

  it('rolls back counter on DB error', async () => {
    seedItems({ quantity: '3', boughtCount: 2 });
    mockFrom.mockReturnValue(fail('error'));

    await useGroceryStore.getState().decrementBought('item-1');

    expect(useGroceryStore.getState().items[0].boughtCount).toBe(2);
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
});
