import { readdirSync, readFileSync, statSync } from 'fs';
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

// Every literal t('section.key') in the app must exist in en.json, or the
// screen shows the raw key ("house_setup.confirm_join_title") to the user.
const ROOT = join(__dirname, '..', '..');
const SOURCE_DIRS = ['app', 'components', 'hooks', 'stores', 'lib', 'utils', 'constants'];
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('translation keys used in code', (): void => {
  it('all exist in en.json', (): void => {
    const keys = Object.keys(flat.en);
    const known = new Set([...keys, ...keys.map((k) => k.replace(PLURAL_SUFFIX, ''))]);
    const missing = new Set<string>();
    for (const file of SOURCE_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"]/g)) {
        if (!known.has(match[1])) missing.add(match[1]);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
