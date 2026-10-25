import { doodleKind } from '@components/bills/art/doodleKind';

describe('doodleKind', () => {
  it('picks the drawing from the category icon', () => {
    expect(doodleKind('cart-outline', 'Groceries')).toBe('cart');
    expect(doodleKind('pizza-outline', 'Outside Food')).toBe('pizza');
    expect(doodleKind('sparkles-outline', 'Entertainment')).toBe('ticket');
    expect(doodleKind('flash-outline', 'Electricity')).toBe('bulb');
    expect(doodleKind('home-outline', 'Rent')).toBe('house');
  });

  it('falls back to the name, in English or Hebrew', () => {
    expect(doodleKind('pricetag-outline', 'Pharmacy')).toBe('firstaid');
    expect(doodleKind(null, 'חשמל')).toBe('bulb');
    expect(doodleKind(undefined, 'Taxi')).toBe('car');
  });

  it('draws a little receipt for anything else', () => {
    expect(doodleKind('cube-outline', 'Light bulbs?')).toBe('receipt');
    expect(doodleKind(null, null)).toBe('receipt');
  });
});
