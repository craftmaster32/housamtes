import { readFileSync } from 'fs';
import { join } from 'path';

// The join/create-house screen once showed raw keys like "house_setup.find_house"
// on its buttons because the words were never added. Every house_setup text the
// screen uses must exist in English (parity.test.ts then covers es/he).

const root = join(__dirname, '..', '..');
const en = JSON.parse(readFileSync(join(root, 'locales', 'en.json'), 'utf8')) as {
  house_setup: Record<string, string>;
};
const screenSource = readFileSync(join(root, 'app', '(onboarding)', 'house-setup.tsx'), 'utf8');
const usedKeys = [...screenSource.matchAll(/t\('house_setup\.([a-z_]+)'/g)].map((m) => m[1]);

describe('house setup screen texts', () => {
  it('finds the texts the screen uses', () => {
    expect(usedKeys.length).toBeGreaterThan(10);
  });

  it.each([...new Set(usedKeys)])('has words for house_setup.%s', (key) => {
    const text = en.house_setup[key] ?? en.house_setup[`${key}_one`];
    expect(text).toBeTruthy();
  });
});
