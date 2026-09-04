// HouseMates — pure helpers shared by the web-push delivery code.
// Deliberately free of Deno/npm imports so it can be unit-tested under Jest
// (see __tests__/webPushCore.test.ts) and type-checked with the app.

interface HasUserId {
  user_id: string;
}

/**
 * Union of the user_ids across several row lists, de-duplicated. Used to gather
 * every recipient of a house whether they have a native push token, a web push
 * subscription, or both — so a web-only member is never dropped.
 */
export function dedupeUserIds(...lists: HasUserId[][]): string[] {
  const seen = new Set<string>();
  for (const list of lists) {
    for (const row of list) seen.add(row.user_id);
  }
  return [...seen];
}

/**
 * Given the settled results of a batch of web-push sends and the subscriptions
 * they correspond to (same order), return the endpoints the push service
 * reported as gone (HTTP 410) so the caller can delete those dead rows.
 */
export function selectExpiredEndpoints<T extends { endpoint: string }>(
  results: PromiseSettledResult<unknown>[],
  subs: T[]
): string[] {
  const expired: string[] = [];
  results.forEach((result, i) => {
    if (
      result.status === 'rejected' &&
      (result.reason as { statusCode?: number } | null)?.statusCode === 410 &&
      subs[i]
    ) {
      expired.push(subs[i].endpoint);
    }
  });
  return expired;
}

/**
 * Returns true when a web-push error is transient and safe to retry.
 * HTTP 410 (Gone) means the subscription is permanently invalid — do not retry.
 */
export function isTransientWebPushError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const statusCode = (err as { statusCode?: number }).statusCode;
  return statusCode !== 410;
}

/**
 * Attempt `send` up to `maxAttempts` times with exponential back-off
 * (500 ms × 2^(attempt−1)). If `isRetryable` returns false for a thrown
 * error the error is re-thrown immediately without further attempts.
 * Pass a custom `delay` in tests to avoid real timers.
 */
export async function retryWithBackoff(
  send: () => Promise<unknown>,
  opts?: {
    maxAttempts?: number;
    isRetryable?: (err: unknown) => boolean;
    delay?: (ms: number) => Promise<void>;
  }
): Promise<void> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const isRetryable = opts?.isRetryable ?? ((_err: unknown): boolean => true);
  const delay =
    opts?.delay ??
    ((ms: number): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await send();
      return;
    } catch (err) {
      if (!isRetryable(err) || attempt >= maxAttempts) throw err;
      await delay(500 * 2 ** (attempt - 1));
    }
  }
}
