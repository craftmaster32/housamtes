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
