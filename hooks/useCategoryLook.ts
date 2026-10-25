import { useCallback } from 'react';
import { useExpenseCategoriesStore, resolveCategoryIcon } from '@stores/expenseCategoriesStore';
import { CATEGORY_META } from '@stores/spendingStore';
import { getCategoryIcon } from '@components/bills/categoryIcons';
import type { IoniconName } from '@/types/icons';

export interface CategoryLook {
  icon: IoniconName;
  /** The category's own colour, or null when it has none (shown in grey ink). */
  color: string | null;
}

/**
 * The icon and colour a category is drawn with: the house's own category
 * (as picked when it was created) first, then the built-in defaults.
 */
export function useCategoryLook(): (name: string | null | undefined) => CategoryLook {
  const categories = useExpenseCategoriesStore((s) => s.categories);
  return useCallback(
    (name: string | null | undefined): CategoryLook => {
      const key = (name ?? '').trim().toLowerCase();
      const own = categories.find((c) => c.name.trim().toLowerCase() === key);
      if (own) return { icon: resolveCategoryIcon(own.icon), color: own.color || null };
      return { icon: getCategoryIcon(key), color: CATEGORY_META[key]?.color ?? null };
    },
    [categories]
  );
}
