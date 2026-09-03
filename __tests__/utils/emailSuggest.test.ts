import { suggestEmailCorrection } from '@utils/emailSuggest';

describe('suggestEmailCorrection', () => {
  it.each([
    ['jane@gmial.com', 'jane@gmail.com'],
    ['jane@gmal.com', 'jane@gmail.com'],
    ['jane@yaho.com', 'jane@yahoo.com'],
    ['jane@hotmial.com', 'jane@hotmail.com'],
    ['jane@outlok.com', 'jane@outlook.com'],
    ['jane@iclod.com', 'jane@icloud.com'],
  ])("suggests a fix for a typo'd domain — %s", (input, expected) => {
    expect(suggestEmailCorrection(input)).toBe(expected);
  });

  it('returns null for an already-correct common domain', () => {
    expect(suggestEmailCorrection('jane@gmail.com')).toBeNull();
  });

  it('returns null for a domain too different to guess confidently', () => {
    expect(suggestEmailCorrection('jane@my-house-company.io')).toBeNull();
  });

  it('returns null when there is no "@"', () => {
    expect(suggestEmailCorrection('not-an-email')).toBeNull();
  });

  it('returns null for an empty domain', () => {
    expect(suggestEmailCorrection('jane@')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(suggestEmailCorrection('Jane@GMIAL.COM')).toBe('jane@gmail.com');
  });
});
