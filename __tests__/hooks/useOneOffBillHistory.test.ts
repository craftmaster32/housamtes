/**
 * QA — useOneOffBillHistory
 *
 * Locks in the category-filter chip logic for the Bills screen:
 *   - Managed (settings) categories keep their configured order.
 *   - A custom category a bill uses but that isn't in the managed list still
 *     appears (regression test for custom categories being invisible when the
 *     picker was backed by a hardcoded list).
 *   - Only categories that actually appear on a bill are surfaced.
 */

import { renderHook } from '@testing-library/react-native';
import type { Bill } from '@stores/billsStore';
import type { ExpenseCategory } from '@stores/expenseCategoriesStore';

let mockBillsState: { bills: Bill[] };
let mockCategoriesState: { categories: ExpenseCategory[]; load: () => void };

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (k: string) => string; i18n: { language: string } } => ({
    t: (k: string): string => k,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@stores/billsStore', () => ({
  useBillsStore: (selector: (s: typeof mockBillsState) => unknown): unknown =>
    selector(mockBillsState),
}));

jest.mock('@stores/expenseCategoriesStore', () => ({
  useExpenseCategoriesStore: (selector: (s: typeof mockCategoriesState) => unknown): unknown =>
    selector(mockCategoriesState),
}));

jest.mock('@stores/recurringBillsStore', () => ({
  useRecurringBillsStore: (
    selector: (s: { bills: unknown[]; payments: unknown[] }) => unknown
  ): unknown => selector({ bills: [], payments: [] }),
}));

jest.mock('@stores/housematesStore', () => ({
  useHousematesStore: (selector: (s: { housemates: unknown[] }) => unknown): unknown =>
    selector({ housemates: [{ id: 'u1', name: 'Ann' }] }),
}));

jest.mock('@stores/authStore', () => ({
  useAuthStore: (selector: (s: { houseId: string | null }) => unknown): unknown =>
    selector({ houseId: 'house-1' }),
}));

import { useOneOffBillHistory } from '@hooks/useOneOffBillHistory';

function bill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: Math.random().toString(36).slice(2),
    title: 'Test',
    amount: 10,
    paidBy: 'u1',
    splitBetween: ['u1'],
    splitAmounts: null,
    splitType: null,
    category: 'Other',
    date: '2026-01-01',
    createdAt: '2026-01-01T00:00:00Z',
    settled: false,
    settledBy: null,
    settledAt: null,
    notes: null,
    receiptUrl: null,
    ...overrides,
  };
}

function cat(name: string, sortOrder: number): ExpenseCategory {
  return { id: name, name, icon: 'pricetag-outline', color: '#000', isDefault: true, sortOrder };
}

describe('useOneOffBillHistory — presentCategories', () => {
  it('orders managed categories by their configured order and appends custom ones', () => {
    mockCategoriesState = {
      categories: [cat('Rent', 0), cat('Groceries', 4), cat('Other', 99)],
      load: (): void => {},
    };
    mockBillsState = {
      // Bills reference Groceries + Rent (managed) and PetCare (custom, unmanaged).
      bills: [
        bill({ category: 'Groceries' }),
        bill({ category: 'PetCare' }),
        bill({ category: 'Rent' }),
      ],
    };

    const { result } = renderHook(() => useOneOffBillHistory(''));

    // Managed order first (Rent before Groceries), then the custom one appended.
    expect(result.current.presentCategories).toEqual(['rent', 'groceries', 'petcare']);
  });

  it('surfaces only categories that appear on a bill', () => {
    mockCategoriesState = {
      categories: [cat('Rent', 0), cat('Groceries', 4), cat('Health', 8)],
      load: (): void => {},
    };
    mockBillsState = { bills: [bill({ category: 'Groceries' })] };

    const { result } = renderHook(() => useOneOffBillHistory(''));

    expect(result.current.presentCategories).toEqual(['groceries']);
  });
});
