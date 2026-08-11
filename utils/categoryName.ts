import type { TFunction } from 'i18next';

/**
 * Category names are stored in the database as free-text (bill.category, recurring
 * bill names, and the expense_categories table's default rows are all English
 * strings). This helper turns a raw stored name into a display name in the user's
 * current language.
 *
 * Known categories map to the shared `bills.cat_*` translation keys. Anything the
 * user typed themselves (a custom category) has no translation, so it's shown as
 * entered — just with a capitalised first letter for consistency.
 */

// Raw stored names (lower-cased) that don't match a `bills.cat_*` key one-to-one.
const ALIASES: Record<string, string> = {
  taxes: 'tax',
  'outside food': 'outside_food',
  ארנונה: 'arnona', // users sometimes name the category in Hebrew
};

export function localizeCategoryName(rawName: string, t: TFunction): string {
  const name = rawName.trim();
  if (!name) return name;

  const key = name.toLowerCase();
  const slug = ALIASES[key] ?? key.replace(/\s+/g, '_');
  const translated = t(`bills.cat_${slug}`, { defaultValue: '' });
  if (translated) return translated;

  // Custom / unknown category — keep the user's own wording.
  return name.charAt(0).toUpperCase() + name.slice(1);
}
