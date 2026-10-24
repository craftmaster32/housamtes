import { areaLabel, categoryLabel, entryTypeLabel } from '@utils/propertyLabels';

const t = (key: string): string => `<${key}>`;

describe('propertyLabels', () => {
  it('translates preset categories and areas', () => {
    expect(categoryLabel(t, 'Plumbing')).toBe('<maintenance.cat_plumbing>');
    expect(areaLabel(t, 'Balcony/Garden')).toBe('<condition.area_balcony_garden>');
    expect(areaLabel(t, 'Bedroom 2')).toBe('<condition.area_bedroom_2>');
  });

  it('keeps custom names as typed', () => {
    expect(areaLabel(t, 'Downstairs toilet')).toBe('Downstairs toilet');
    expect(categoryLabel(t, 'Roof')).toBe('Roof');
  });

  it('uses the singular word for an update entry', () => {
    expect(entryTypeLabel(t, 'update')).toBe('<condition.type_update>');
    expect(entryTypeLabel(t, 'move_in')).toBe('<condition.move_in>');
  });
});
