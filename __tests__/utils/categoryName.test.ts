import type { TFunction } from 'i18next';
import { localizeCategoryName } from '@utils/categoryName';

// Minimal fake translator mirroring i18next's `t(key, { defaultValue })` contract:
// returns the mapped value for known keys, otherwise the provided defaultValue.
const TRANSLATIONS: Record<string, string> = {
  'bills.cat_groceries': 'קניות',
  'bills.cat_internet': 'אינטרנט',
  'bills.cat_arnona': 'ארנונה',
  'bills.cat_tax': 'מיסים',
  'bills.cat_outside_food': 'אוכל בחוץ',
};

const t = ((key: string, opts?: { defaultValue?: string }): string =>
  TRANSLATIONS[key] ?? opts?.defaultValue ?? key) as unknown as TFunction;

describe('localizeCategoryName', () => {
  it('translates a known category regardless of stored casing', () => {
    expect(localizeCategoryName('Groceries', t)).toBe('קניות');
    expect(localizeCategoryName('groceries', t)).toBe('קניות');
    expect(localizeCategoryName('  Internet  ', t)).toBe('אינטרנט');
  });

  it('maps aliases to the canonical translation key', () => {
    expect(localizeCategoryName('Taxes', t)).toBe('מיסים');
    expect(localizeCategoryName('Outside Food', t)).toBe('אוכל בחוץ');
    expect(localizeCategoryName('ארנונה', t)).toBe('ארנונה');
  });

  it('keeps a custom category as entered, capitalising the first letter', () => {
    expect(localizeCategoryName('my gym', t)).toBe('My gym');
  });

  it('returns an empty string unchanged', () => {
    expect(localizeCategoryName('   ', t)).toBe('');
  });
});
