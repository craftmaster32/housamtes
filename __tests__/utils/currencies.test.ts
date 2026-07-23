import { splitMoney, formatFull } from '@constants/currencies';

describe('splitMoney', () => {
  it('splits a shekel amount into aligned symbol, whole, and fraction', () => {
    expect(splitMoney(746.46, 'ILS')).toEqual({ symbol: '₪', whole: '746', fraction: '.46' });
  });

  it('keeps thousands separators in the whole part', () => {
    const { symbol, whole, fraction } = splitMoney(1234.5, 'ILS');
    expect(symbol).toBe('₪');
    expect(whole).toBe('1,234');
    expect(fraction).toBe('.50');
  });

  it('returns an empty fraction for zero-decimal currencies (JPY)', () => {
    expect(splitMoney(1500, 'JPY')).toEqual({ symbol: '¥', whole: '1,500', fraction: '' });
  });

  it('handles zero', () => {
    expect(splitMoney(0, 'USD')).toEqual({ symbol: '$', whole: '0', fraction: '.00' });
  });

  it('recomposes to the same string formatFull produces', () => {
    const { symbol, whole, fraction } = splitMoney(46, 'ILS');
    expect(`${symbol}${whole}${fraction}`).toBe(formatFull(46, 'ILS'));
  });

  it('falls back gracefully for an unknown currency code', () => {
    // Unknown codes resolve to the default currency (ILS) inside the module.
    const parts = splitMoney(10, 'XYZ');
    expect(parts.symbol).toBe('₪');
    expect(parts.whole).toBe('10');
  });
});
