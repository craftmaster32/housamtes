import { fmtFull, fmtShort, pctChange } from '@components/spending/spendingFormat';

describe('spendingFormat', () => {
  it('formats amounts in full and short', () => {
    expect(fmtFull(12.5, '£')).toBe('£12.50');
    expect(fmtShort(980, '£')).toBe('£980');
    expect(fmtShort(1250, '£')).toBe('£1.3k');
  });

  it('gives the change from last month, or nothing when last month was zero', () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(80, 100)).toBe(-20);
    expect(pctChange(50, 0)).toBeNull();
  });
});
