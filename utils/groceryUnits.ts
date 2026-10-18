export const UNIT_OPTS = ['ml', 'L', 'g', 'kg'] as const;
export type GroceryUnit = (typeof UNIT_OPTS)[number];

export const UNIT_LABELS_HE: Record<GroceryUnit, string> = {
  ml: 'מ"ל',
  L: 'ליטר',
  g: 'גרם',
  kg: 'ק"ג',
};

/** The unit as the viewer should read it (Hebrew gets its own words). */
export function unitLabel(unit: GroceryUnit, isHebrew: boolean): string {
  return isHebrew ? UNIT_LABELS_HE[unit] : unit;
}

// `quantity` is stored as a language-neutral "<number><unit>" string (e.g. "2kg")
// so it stays consistent for every housemate regardless of who added it.
// Only re-localize the unit suffix here, at render time, for the viewer's language.
const SORTED_UNIT_OPTS = [...UNIT_OPTS].sort((a, b) => b.length - a.length);

export function localizeQuantityForDisplay(quantity: string, isHebrew: boolean): string {
  if (!isHebrew) return quantity;
  for (const u of SORTED_UNIT_OPTS) {
    if (quantity.endsWith(u)) {
      const prefix = quantity.slice(0, -u.length);
      if (/^\d+(\.\d+)?$/.test(prefix)) {
        return `${prefix} ${UNIT_LABELS_HE[u]}`;
      }
    }
  }
  return quantity;
}
