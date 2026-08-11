import { readFileSync } from 'fs';
import { join } from 'path';

// Locks in translation completeness so an English string can't silently ship
// to Spanish/Hebrew users. Every key added to en.json must also exist — with a
// non-empty value — in es.json and he.json (that parity also covers plural
// _one/_other variants). If this test fails, add the missing key to every locale.

type Json = { [key: string]: string | Json };

const LOCALES = ['en', 'es', 'he'] as const;
type Locale = (typeof LOCALES)[number];

function load(locale: Locale): Json {
  const path = join(__dirname, '..', '..', 'locales', `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Json;
}

function flatten(obj: Json, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[nextKey] = value;
    } else {
      Object.assign(out, flatten(value, nextKey));
    }
  }
  return out;
}

const flat: Record<Locale, Record<string, string>> = {
  en: flatten(load('en')),
  es: flatten(load('es')),
  he: flatten(load('he')),
};

describe('locale parity', (): void => {
  const enKeys = Object.keys(flat.en).sort();

  it('en has a non-trivial number of keys (sanity)', (): void => {
    expect(enKeys.length).toBeGreaterThan(1000);
  });

  it.each(['es', 'he'] as const)('%s has exactly the same keys as en', (locale): void => {
    const localeKeys = new Set(Object.keys(flat[locale]));
    const missing = enKeys.filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !(k in flat.en));
    expect({ locale, missing, extra }).toEqual({ locale, missing: [], extra: [] });
  });

  it.each(LOCALES)('%s has no empty or whitespace-only values', (locale): void => {
    const blank = Object.entries(flat[locale])
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });
});
