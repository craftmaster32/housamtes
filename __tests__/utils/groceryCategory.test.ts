import { detectCategory, OTHER_CATEGORY, toneColors } from '@utils/groceryCategory';
import { localizeQuantityForDisplay, unitLabel } from '@utils/groceryUnits';

describe('detectCategory', () => {
  it('puts fruit and veg in produce', () => {
    expect(detectCategory('Avocados').labelKey).toBe('grocery.cat_produce');
  });

  it('puts oat milk in dairy, not produce', () => {
    expect(detectCategory('Oat milk').labelKey).toBe('grocery.cat_dairy_fridge');
  });

  it('falls back to Other for unknown items', () => {
    expect(detectCategory('Batteries')).toBe(OTHER_CATEGORY);
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
