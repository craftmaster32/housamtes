// Sentry is loaded lazily so importing this file never triggers native module
// access in Expo Go (which doesn't ship Sentry's native binary).
// In development __DEV__ is true so getSentry() always returns null — no-op.

type SentryType = typeof import('@sentry/react-native');

const getSentry = (): SentryType | null => {
  if (__DEV__ || !process.env.EXPO_PUBLIC_SENTRY_DSN) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@sentry/react-native') as SentryType;
  } catch {
    return null;
  }
};

export function initErrorTracking(): void {
  const Sentry = getSentry();
  if (!Sentry) return;
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: 'production',
    beforeSend(event) {
      if (event.request?.data) delete event.request.data;
      return event;
    },
  });
}

export function identifyUser(userId: string): void {
  getSentry()?.setUser({ id: userId });
}

export function clearUser(): void {
  getSentry()?.setUser(null);
}

export function captureError(err: unknown, context?: Record<string, string>): void {
  getSentry()?.captureException(err, context ? { extra: context } : undefined);
}

export function captureMessage(message: string): void {
  getSentry()?.captureMessage(message, 'warning');
}
