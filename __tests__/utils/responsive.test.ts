import { BASE_WIDTH, scaleForWidth, moderateScaleForWidth } from '@utils/responsive';

// Every current + recent iPhone logical width (points), smallest to largest,
// plus tablet / desktop-web widths the deployed web build can land on.
const IPHONE_WIDTHS = [
  320, // SE (1st gen) / 5s — narrowest still-supported
  375, // 13 mini / SE 2·3 / 8 / X
  390, // 12 / 13 / 14
  393, // 15 / 16 / 17
  402, // 17 base — the design baseline
  428, // Plus models
  440, // Pro Max
  768, // iPad portrait
  1440, // desktop web
];

describe('responsive scaling', () => {
  it('leaves the design baseline (iPhone 17) untouched', () => {
    expect(scaleForWidth(BASE_WIDTH)).toBe(1);
    expect(moderateScaleForWidth(28, BASE_WIDTH)).toBe(28);
    expect(moderateScaleForWidth(16, BASE_WIDTH)).toBe(16);
  });

  it('never returns a broken size (zero, negative, NaN) at any width', () => {
    for (const w of IPHONE_WIDTHS) {
      for (const size of [4, 8, 11, 16, 28, 44, 158]) {
        const out = moderateScaleForWidth(size, w);
        expect(Number.isFinite(out)).toBe(true);
        expect(out).toBeGreaterThan(0);
      }
    }
  });

  it('shrinks on smaller phones and grows on bigger ones (monotonic)', () => {
    const at = (w: number): number => moderateScaleForWidth(28, w);
    for (let i = 1; i < IPHONE_WIDTHS.length; i++) {
      expect(at(IPHONE_WIDTHS[i])).toBeGreaterThanOrEqual(at(IPHONE_WIDTHS[i - 1]));
    }
    expect(at(320)).toBeLessThan(28); // smallest phone shrinks
    expect(at(440)).toBeGreaterThan(28); // Pro Max grows a little
  });

  it('clamps so the smallest phone stays readable and web never explodes', () => {
    // Even at an absurd width the factor is bounded, so a 16pt size stays sane.
    expect(moderateScaleForWidth(16, 200)).toBeGreaterThanOrEqual(13);
    expect(moderateScaleForWidth(16, 5000)).toBeLessThanOrEqual(18);
  });

  it('degrades gracefully on a bogus width instead of throwing', () => {
    expect(() => moderateScaleForWidth(16, 0)).not.toThrow();
    expect(moderateScaleForWidth(16, 0)).toBeGreaterThan(0);
    expect(moderateScaleForWidth(16, NaN)).toBeGreaterThan(0);
  });
});
