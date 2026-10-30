import { sentenceCase } from '@components/dashboard/cards/cardStyles';

jest.mock('@utils/responsive', () => ({ ms: (n: number) => n, mf: (n: number) => n }));

describe('sentenceCase (home card labels)', () => {
  it('turns old all-caps labels into sentence case', () => {
    expect(sentenceCase('PARKING')).toBe('Parking');
    expect(sentenceCase('TASKS')).toBe('Tasks');
  });

  it('leaves labels that already have mixed case alone', () => {
    expect(sentenceCase('Grocery list')).toBe('Grocery list');
  });

  it('leaves caseless scripts like Hebrew alone', () => {
    expect(sentenceCase('חניה')).toBe('חניה');
  });
});
