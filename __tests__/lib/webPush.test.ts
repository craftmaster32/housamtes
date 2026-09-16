/**
 * QA — webPush.syncWebPushSubscription
 *
 * Guards the "toggle says On but nothing is delivered" fix: the reconcile helper
 * must report real deliverability, never a browser-only subscription.
 *   - Persisted + a live browser subscription  → true
 *   - Persistence skipped (missing VAPID build key) → null (indeterminate),
 *     NOT true — even when a stale browser subscription lingers
 *   - Permission not granted → false
 *   - subscribeAndSave throws (e.g. server upsert fails) → null
 */

import { Platform } from 'react-native';
import { ok, fail } from '../__helpers__/supabaseMock';

const mockFrom = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: { from: (...a: unknown[]): unknown => mockFrom(...a) },
}));

jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));

jest.mock('@lib/i18n', () => ({ __esModule: true, default: { language: 'en' } }));

import { syncWebPushSubscription } from '@lib/webPush';

const originalOS = Platform.OS;
const globalRef = globalThis as Record<string, unknown>;
const saved: Record<string, PropertyDescriptor | undefined> = {};

function stub(name: string, value: unknown): void {
  saved[name] = Object.getOwnPropertyDescriptor(globalRef, name);
  Object.defineProperty(globalRef, name, { value, configurable: true, writable: true });
}

function makeSubscription(): unknown {
  return {
    endpoint: 'https://push.example/abc',
    toJSON: (): unknown => ({ keys: { p256dh: 'p256', auth: 'authkey' } }),
    unsubscribe: jest.fn().mockResolvedValue(true),
  };
}

function stubServiceWorker(
  getSubscription: () => Promise<unknown>,
  subscribe?: () => Promise<unknown>
): void {
  const registration = {
    pushManager: {
      getSubscription: jest.fn(getSubscription),
      subscribe: jest.fn(
        subscribe ?? ((): Promise<unknown> => Promise.resolve(makeSubscription()))
      ),
    },
  };
  stub('navigator', {
    serviceWorker: {
      register: jest.fn().mockResolvedValue(registration),
      getRegistration: jest.fn().mockResolvedValue(registration),
      ready: Promise.resolve(registration),
    },
  });
}

describe('syncWebPushSubscription', () => {
  beforeEach(() => {
    Platform.OS = 'web';
    mockFrom.mockReset();
    process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY = 'BQ-test-key';
    stub('window', { PushManager: function (): void {} });
    stub('Notification', { permission: 'granted' });
  });

  afterEach(() => {
    Platform.OS = originalOS;
    for (const [name, desc] of Object.entries(saved)) {
      if (desc) Object.defineProperty(globalRef, name, desc);
      else delete globalRef[name];
    }
  });

  it('returns true when a subscription is persisted and live', async () => {
    // No existing sub → subscribe mints one; upsert succeeds; getRegistration finds it.
    stubServiceWorker(() => Promise.resolve(null));
    mockFrom.mockReturnValue(ok()); // upsert ok
    // Second lookup (getSubscription after save) returns a live sub.
    const registration = await (
      globalRef.navigator as { serviceWorker: { getRegistration: () => Promise<unknown> } }
    ).serviceWorker.getRegistration();
    (registration as { pushManager: { getSubscription: jest.Mock } }).pushManager.getSubscription =
      jest.fn().mockResolvedValue(makeSubscription());

    await expect(syncWebPushSubscription('u1', 'h1')).resolves.toBe(true);
  });

  it('returns null (not true) when the VAPID build key is missing', async () => {
    delete process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    // A stale browser subscription lingers — must NOT be reported as "on".
    stubServiceWorker(() => Promise.resolve(makeSubscription()));

    await expect(syncWebPushSubscription('u1', 'h1')).resolves.toBeNull();
  });

  it('returns false when notification permission is not granted', async () => {
    stub('Notification', { permission: 'default' });
    stubServiceWorker(() => Promise.resolve(makeSubscription()));

    await expect(syncWebPushSubscription('u1', 'h1')).resolves.toBe(false);
  });

  it('returns null when persisting the subscription fails', async () => {
    stubServiceWorker(() => Promise.resolve(null));
    mockFrom.mockReturnValue(fail('upsert boom')); // upsert error → subscribeAndSave throws

    await expect(syncWebPushSubscription('u1', 'h1')).resolves.toBeNull();
  });
});
