import { asWord } from '@utils/asWord';

describe('asWord', () => {
  it('turns a capitalised section name into a word', () => {
    expect(asWord('GENERAL')).toBe('General');
    expect(asWord('HOUSE')).toBe('House');
  });

  it('leaves Hebrew (no letter case) as it is', () => {
    expect(asWord('כללי')).toBe('כללי');
  });
});
