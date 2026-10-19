/**
 * QA — which database the app talks to
 *
 * Vercel preview builds (pull-request links) must use the separate test
 * database so trying things out never touches real houses or notifies real
 * users. Every other build (the live site, the iPhone app) must keep using the
 * main database.
 */

const mockCreateClient = jest.fn(() => ({ auth: {} }));
jest.mock('@supabase/supabase-js', () => ({ createClient: mockCreateClient }));
jest.mock('expo-secure-store', () => ({}));
jest.mock('react-native-url-polyfill/auto', () => ({}));

const ORIGINAL_ENV = process.env;

function loadClientWith(env: Record<string, string | undefined>): unknown[] {
  process.env = { ...ORIGINAL_ENV, ...env };
  mockCreateClient.mockClear();
  jest.isolateModules(() => {
    require('@lib/supabase');
  });
  return mockCreateClient.mock.calls[0] as unknown[];
}

const LIVE = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://live.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'live-key',
  EXPO_PUBLIC_STAGING_SUPABASE_URL: 'https://test.supabase.co',
  EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY: 'test-key',
};

describe('Supabase project selection', () => {
  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('uses the test database on a Vercel preview build', () => {
    const [url, key] = loadClientWith({ ...LIVE, EXPO_PUBLIC_APP_ENV: 'preview' });
    expect(url).toBe('https://test.supabase.co');
    expect(key).toBe('test-key');
  });

  it('keeps the live database on the production build', () => {
    const [url, key] = loadClientWith({ ...LIVE, EXPO_PUBLIC_APP_ENV: 'production' });
    expect(url).toBe('https://live.supabase.co');
    expect(key).toBe('live-key');
  });

  it('keeps the live database when the build environment is not set (iPhone app)', () => {
    const [url] = loadClientWith({ ...LIVE, EXPO_PUBLIC_APP_ENV: undefined });
    expect(url).toBe('https://live.supabase.co');
  });

  it('falls back to the live database on a preview if the test values are missing', () => {
    const [url] = loadClientWith({
      ...LIVE,
      EXPO_PUBLIC_APP_ENV: 'preview',
      EXPO_PUBLIC_STAGING_SUPABASE_URL: undefined,
      EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY: undefined,
    });
    expect(url).toBe('https://live.supabase.co');
  });

  it('never mixes projects when only one test value is set', () => {
    const [url, key] = loadClientWith({
      ...LIVE,
      EXPO_PUBLIC_APP_ENV: 'preview',
      EXPO_PUBLIC_STAGING_SUPABASE_ANON_KEY: undefined,
    });
    expect(url).toBe('https://live.supabase.co');
    expect(key).toBe('live-key');
  });
});
