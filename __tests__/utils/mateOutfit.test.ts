import { mateOutfitFor } from '@utils/mateOutfit';

const at = (month: number, day: number, hour: number): Date => new Date(2026, month, day, hour);

describe("Mate's outfit", () => {
  it('wears a party hat over New Year, even at midnight', () => {
    expect(mateOutfitFor(at(11, 31, 23))).toBe('partyHat');
    expect(mateOutfitFor(at(0, 1, 2))).toBe('partyHat');
  });

  it('wears a nightcap late at night', () => {
    expect(mateOutfitFor(at(6, 10, 22))).toBe('nightcap');
    expect(mateOutfitFor(at(6, 10, 5))).toBe('nightcap');
  });

  it('wears a scarf on winter days', () => {
    expect(mateOutfitFor(at(0, 15, 12))).toBe('scarf');
    expect(mateOutfitFor(at(11, 5, 12))).toBe('scarf');
  });

  it('wears nothing extra on an ordinary day', () => {
    expect(mateOutfitFor(at(6, 10, 12))).toBeNull();
    expect(mateOutfitFor(at(2, 1, 6))).toBeNull();
  });
});
