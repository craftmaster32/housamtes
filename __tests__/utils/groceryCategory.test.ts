import { detectCategory, detectItemIcon, OTHER_CATEGORY, toneColors } from '@utils/groceryCategory';
import { localizeQuantityForDisplay, unitLabel } from '@utils/groceryUnits';

describe('detectCategory', () => {
  it('puts fruit and veg in produce', () => {
    expect(detectCategory('Avocados').labelKey).toBe('grocery.cat_produce');
  });

  it('puts oat milk in dairy, not produce', () => {
    expect(detectCategory('Oat milk').labelKey).toBe('grocery.cat_dairy_fridge');
  });

  it.each([
    ['מטליות ניקוי כללי', 'grocery.cat_household'],
    ['מלכודות עש המזון', 'grocery.cat_household'],
    ['עגבניות שרי', 'grocery.cat_produce'],
    ['חלב 3%', 'grocery.cat_dairy_fridge'],
    ['ביצים', 'grocery.cat_dairy_fridge'],
    ['חזה עוף', 'grocery.cat_meat_fish'],
    ['דגני בוקר', 'grocery.cat_pantry'],
    ['תה ירוק', 'grocery.cat_pantry'],
    ['מיץ תפוזים', 'grocery.cat_drinks'],
    ['שמפו', 'grocery.cat_personal_care'],
    ['במבה', 'grocery.cat_snacks'],
    ['Eggs', 'grocery.cat_dairy_fridge'],
    ['Peanut butter', 'grocery.cat_pantry'],
    ['Watermelon', 'grocery.cat_produce'],
    ['Steak', 'grocery.cat_meat_fish'],
    ['Candles', 'grocery.cat_other'],
    ['Ice cream', 'grocery.cat_snacks'],
    ['Leche de avena', 'grocery.cat_dairy_fridge'],
    ['Papel higiénico', 'grocery.cat_household'],
  ])('puts "%s" in %s', (name, key) => {
    expect(detectCategory(name).labelKey).toBe(key);
  });

  it('falls back to Other for unknown items', () => {
    expect(detectCategory('Birthday present')).toBe(OTHER_CATEGORY);
  });
});

describe('detectItemIcon', () => {
  it('gives common items their own icon', () => {
    expect(detectItemIcon('ביצים')).toBe('egg-outline');
    expect(detectItemIcon('Salmon')).toBe('fish-outline');
    expect(detectItemIcon('קפה')).toBe('cafe-outline');
    expect(detectItemIcon('Ice cream')).toBe('ice-cream-outline');
  });

  it("falls back to the aisle's icon", () => {
    expect(detectItemIcon('עגבניות')).toBe('leaf-outline');
    expect(detectItemIcon('Batteries AA')).toBe('battery-half-outline');
    expect(detectItemIcon('Something odd')).toBe('cube-outline');
  });
});

describe('toneColors', () => {
  it('returns different palettes for light and dark mode', () => {
    expect(toneColors('green', false).bg).not.toBe(toneColors('green', true).bg);
  });
});

describe('grocery units', () => {
  it('keeps the stored quantity as-is outside Hebrew', () => {
    expect(localizeQuantityForDisplay('2kg', false)).toBe('2kg');
  });

  it('shows the Hebrew unit word for Hebrew readers', () => {
    expect(localizeQuantityForDisplay('2kg', true)).toBe('2 ק"ג');
    expect(unitLabel('L', true)).toBe('ליטר');
  });

  it('leaves non-numeric quantities alone', () => {
    expect(localizeQuantityForDisplay('a few', true)).toBe('a few');
  });
});
