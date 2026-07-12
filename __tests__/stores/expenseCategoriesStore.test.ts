/**
 * QA — expenseCategoriesStore
 *
 * Money-adjacent store: categories drive bill grouping and spending analysis.
 * Locks in:
 *   remove       — deletes only on DB success; state untouched on failure
 *   add          — throws a plain-English error on DB failure
 *   seedDefaults — surfaces upsert failures instead of silently leaving the
 *                  category list empty (regression test for the silent-failure
 *                  fix in the stabilization pass)
 */

import { ok, fail } from '../__helpers__/supabaseMock';

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...a: unknown[]): unknown => mockFrom(...a),
  },
}));

jest.mock('@lib/errorTracking', () => ({
  captureError: jest.fn(),
}));

jest.mock('@stores/authStore', () => ({
  useAuthStore: { getState: (): { houseId: string } => ({ houseId: 'h1' }) },
}));

import {
  useExpenseCategoriesStore,
  type ExpenseCategory,
} from '../../stores/expenseCategoriesStore';

function category(overrides: Partial<ExpenseCategory> = {}): ExpenseCategory {
  return {
    id: 'c1',
    name: 'Rent',
    icon: '🏠',
    color: '#8B5CF6',
    isDefault: true,
    sortOrder: 0,
    ...overrides,
  };
}

beforeEach(() => {
  useExpenseCategoriesStore.setState({ categories: [], isLoading: false, error: null });
  jest.clearAllMocks();
});

describe('expenseCategoriesStore — remove', () => {
  it('removes only the targeted category on success', async () => {
    useExpenseCategoriesStore.setState({
      categories: [category({ id: 'c1' }), category({ id: 'c2', name: 'Water' })],
    });
    mockFrom.mockReturnValue(ok());

    await useExpenseCategoriesStore.getState().remove('c1');

    const cats = useExpenseCategoriesStore.getState().categories;
    expect(cats).toHaveLength(1);
    expect(cats[0].id).toBe('c2');
  });

  it('throws and keeps the category when the DB delete fails', async () => {
    useExpenseCategoriesStore.setState({ categories: [category({ id: 'c1' })] });
    mockFrom.mockReturnValue(fail('RLS violation'));

    await expect(useExpenseCategoriesStore.getState().remove('c1')).rejects.toThrow(
      'Could not delete the category. Please try again.'
    );

    expect(useExpenseCategoriesStore.getState().categories).toHaveLength(1);
  });
});

describe('expenseCategoriesStore — add', () => {
  it('throws a plain-English error and leaves state unchanged on DB failure', async () => {
    mockFrom.mockReturnValue(fail('insert error'));

    await expect(
      useExpenseCategoriesStore.getState().add({ name: 'Pets', icon: '🐕', color: '#10B981' }, 'h1')
    ).rejects.toThrow('Could not save the category. Please try again.');

    expect(useExpenseCategoriesStore.getState().categories).toHaveLength(0);
  });
});

describe('expenseCategoriesStore — seedDefaults', () => {
  it('populates the default categories on success', async () => {
    mockFrom.mockReturnValue(
      ok([
        { id: 'c1', name: 'Rent', icon: '🏠', color: '#8B5CF6', is_default: true, sort_order: 0 },
      ])
    );

    await useExpenseCategoriesStore.getState().seedDefaults('h1');

    const s = useExpenseCategoriesStore.getState();
    expect(s.categories).toHaveLength(1);
    expect(s.categories[0]).toMatchObject({ name: 'Rent', isDefault: true });
    expect(s.isLoading).toBe(false);
  });

  it('throws a plain-English error when the upsert fails instead of silently leaving categories empty', async () => {
    mockFrom.mockReturnValue(fail('unique constraint'));

    await expect(useExpenseCategoriesStore.getState().seedDefaults('h1')).rejects.toThrow(
      'Could not set up your categories. Please try again.'
    );
  });

  it('load() recovers from a failed seed: no crash, isLoading resets, error surfaced to UI', async () => {
    // First call: select returns empty list → triggers seed; second call: upsert fails
    mockFrom.mockReturnValueOnce(ok([])).mockReturnValueOnce(fail('unique constraint'));

    await useExpenseCategoriesStore.getState().load('h1');

    const s = useExpenseCategoriesStore.getState();
    expect(s.isLoading).toBe(false); // never stuck on a spinner
    expect(s.categories).toEqual([]);
    expect(s.error).toBe('Could not load your categories. Please try again.');
  });

  it('load() clears a previous error on success', async () => {
    useExpenseCategoriesStore.setState({
      error: 'Could not load your categories. Please try again.',
    });
    mockFrom.mockReturnValue(
      ok([
        { id: 'c1', name: 'Rent', icon: '🏠', color: '#8B5CF6', is_default: true, sort_order: 0 },
      ])
    );

    await useExpenseCategoriesStore.getState().load('h1');

    expect(useExpenseCategoriesStore.getState().error).toBeNull();
  });

  it('clearError resets the error field', () => {
    useExpenseCategoriesStore.setState({ error: 'boom' });

    useExpenseCategoriesStore.getState().clearError();

    expect(useExpenseCategoriesStore.getState().error).toBeNull();
  });
});

describe('expenseCategoriesStore — add success', () => {
  it('appends the inserted category mapped from the DB row', async () => {
    useExpenseCategoriesStore.setState({ categories: [category()] });
    mockFrom.mockReturnValue(
      ok({
        id: 'c2',
        name: 'Pets',
        icon: '🐕',
        color: '#10B981',
        is_default: false,
        sort_order: 50,
      })
    );

    await useExpenseCategoriesStore
      .getState()
      .add({ name: 'Pets', icon: '🐕', color: '#10B981' }, 'h1');

    const cats = useExpenseCategoriesStore.getState().categories;
    expect(cats).toHaveLength(2);
    expect(cats[1]).toEqual({
      id: 'c2',
      name: 'Pets',
      icon: '🐕',
      color: '#10B981',
      isDefault: false,
      sortOrder: 50,
    });
  });
});

describe('expenseCategoriesStore — update', () => {
  it('applies the changes to the matching category only', async () => {
    useExpenseCategoriesStore.setState({
      categories: [category(), category({ id: 'c2', name: 'Food' })],
    });
    mockFrom.mockReturnValue(ok(null));

    await useExpenseCategoriesStore
      .getState()
      .update('c2', { name: 'Takeaway', icon: '🍔', color: '#F59E0B' });

    const cats = useExpenseCategoriesStore.getState().categories;
    expect(cats[0].name).toBe('Rent'); // untouched
    expect(cats[1]).toMatchObject({ id: 'c2', name: 'Takeaway', icon: '🍔', color: '#F59E0B' });
  });

  it('throws and keeps state unchanged when the DB update fails', async () => {
    useExpenseCategoriesStore.setState({ categories: [category({ id: 'c2', name: 'Food' })] });
    mockFrom.mockReturnValue(fail('db down'));

    await expect(
      useExpenseCategoriesStore
        .getState()
        .update('c2', { name: 'Takeaway', icon: '🍔', color: '#F59E0B' })
    ).rejects.toThrow('Could not update the category. Please try again.');
    expect(useExpenseCategoriesStore.getState().categories[0].name).toBe('Food');
  });
});

describe('expenseCategoriesStore — load routing', () => {
  it('aborts when the house ID does not match auth', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await useExpenseCategoriesStore.getState().load('other-house');

    expect(mockFrom).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('seeds the defaults when the house has no categories yet', async () => {
    // First call (select) returns empty; second call (upsert) returns seeded rows.
    mockFrom
      .mockReturnValueOnce(ok([]))
      .mockReturnValueOnce(
        ok([
          { id: 'c1', name: 'Rent', icon: '🏠', color: '#8B5CF6', is_default: true, sort_order: 0 },
        ])
      );

    await useExpenseCategoriesStore.getState().load('h1');

    const s = useExpenseCategoriesStore.getState();
    expect(s.categories).toHaveLength(1);
    expect(s.categories[0].name).toBe('Rent');
    expect(s.isLoading).toBe(false);
  });
});
