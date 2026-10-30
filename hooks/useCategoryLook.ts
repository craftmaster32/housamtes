import { useCallback } from 'react';
import { useExpenseCategoriesStore, resolveCategoryIcon } from '@stores/expenseCategoriesStore';
import { CATEGORY_META } from '@stores/spendingStore';
import { getCategoryIcon } from '@components/bills/categoryIcons';
import { doodleKind, type DoodleKind } from '@components/bills/art/doodleKind';

export interface CategoryLook {
  /** Which hand-drawn picture the category gets. */
  kind: DoodleKind;
  /** The category's own colour, or null when it has none (shown in grey ink). */
  color: string | null;
}

/**
 * The drawing and colour a category gets: the house's own category
 * (as picked when it was created) first, then the built-in defaults.
 */
export function useCategoryLook(): (name: string | null | undefined) => CategoryLook {
  const categories = useExpenseCategoriesStore((s) => s.categories);
  return useCallback(
    (name: string | null | undefined): CategoryLook => {
      const key = (name ?? '').trim().toLowerCase();
      const own = categories.find((c) => c.name.trim().toLowerCase() === key);
      if (own) {
        return {
          kind: doodleKind(resolveCategoryIcon(own.icon), own.name),
          color: own.color || null,
        };
      }
      return {
        kind: doodleKind(getCategoryIcon(key), key),
        color: CATEGORY_META[key]?.color ?? null,
      };
    },
    [categories]
  );
}
