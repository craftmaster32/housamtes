import { enUS, es as dateFnsEs, he as dateFnsHe, type Locale } from 'date-fns/locale';

const DATE_FNS_LOCALES: Record<string, Locale> = { en: enUS, es: dateFnsEs, he: dateFnsHe };

export function getDateFnsLocale(language: string): Locale {
  return DATE_FNS_LOCALES[language] ?? enUS;
}

export function monthNameFromKey(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString(locale, { month: 'short' })
    .toUpperCase();
}

export function localizedMonthLabel(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
}
