import { formatDateDDMMYYYY, getDateFnsLocale } from '@utils/dates';

describe('formatDateDDMMYYYY', () => {
  it('formats an ISO date-only string as dd/mm/yyyy', () => {
    expect(formatDateDDMMYYYY('2026-07-03')).toBe('03/07/2026');
  });

  it('keeps zero-padding from the input', () => {
    expect(formatDateDDMMYYYY('2025-01-09')).toBe('09/01/2025');
  });

  it('handles end-of-year dates', () => {
    expect(formatDateDDMMYYYY('2024-12-31')).toBe('31/12/2024');
  });
});

describe('getDateFnsLocale', () => {
  it('falls back to English for unknown languages', () => {
    expect(getDateFnsLocale('fr')).toBe(getDateFnsLocale('en'));
  });

  it('returns distinct locales for supported languages', () => {
    expect(getDateFnsLocale('he')).not.toBe(getDateFnsLocale('en'));
    expect(getDateFnsLocale('es')).not.toBe(getDateFnsLocale('en'));
  });
});
