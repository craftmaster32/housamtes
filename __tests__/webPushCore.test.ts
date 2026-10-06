import {
  dedupeUserIds,
  selectExpiredEndpoints,
  retryWithBackoff,
  isTransientWebPushError,
} from '../supabase/functions/_shared/webPushCore';

describe('dedupeUserIds', () => {
  it('unions native-token users and web-sub users without duplicates', () => {
    const tokens = [{ user_id: 'a' }, { user_id: 'b' }];
    const webSubs = [{ user_id: 'b' }, { user_id: 'c' }];
    expect(dedupeUserIds(tokens, webSubs).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps a web-only user that has no native token (the original bug)', () => {
    const tokens: Array<{ user_id: string }> = [];
    const webSubs = [{ user_id: 'web-only' }];
    expect(dedupeUserIds(tokens, webSubs)).toEqual(['web-only']);
  });

  it('returns an empty list when there are no recipients', () => {
    expect(dedupeUserIds([], [])).toEqual([]);
  });
});

describe('isTransientWebPushError', () => {
  it('returns false for HTTP 410 — subscription is gone and must not be retried', () => {
    expect(isTransientWebPushError({ statusCode: 410 })).toBe(false);
  });

  it('returns true for other HTTP errors (e.g. 500, 503) — these are transient', () => {
    expect(isTransientWebPushError({ statusCode: 500 })).toBe(true);
    expect(isTransientWebPushError({ statusCode: 503 })).toBe(true);
  });

  it('returns true for non-object errors', () => {
    expect(isTransientWebPushError('boom')).toBe(true);
    expect(isTransientWebPushError(null)).toBe(true);
    expect(isTransientWebPushError(undefined)).toBe(true);
  });
});

describe('retryWithBackoff', () => {
  const noDelay = (): Promise<void> => Promise.resolve();

  it('resolves on the first attempt when send succeeds', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await retryWithBackoff(send, { delay: noDelay });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries and resolves when a later attempt succeeds', async () => {
    let calls = 0;
    const send = jest.fn().mockImplementation(() => {
      calls++;
      if (calls < 3) return Promise.reject({ statusCode: 503 });
      return Promise.resolve(undefined);
    });
    await retryWithBackoff(send, {
      maxAttempts: 3,
      isRetryable: isTransientWebPushError,
      delay: noDelay,
    });
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('throws after all attempts are exhausted', async () => {
    const err = { statusCode: 503 };
    const send = jest.fn().mockRejectedValue(err);
    await expect(
      retryWithBackoff(send, { maxAttempts: 3, isRetryable: isTransientWebPushError, delay: noDelay })
    ).rejects.toEqual(err);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 410 error and re-throws immediately', async () => {
    const err = { statusCode: 410 };
    const send = jest.fn().mockRejectedValue(err);
    await expect(
      retryWithBackoff(send, { maxAttempts: 3, isRetryable: isTransientWebPushError, delay: noDelay })
    ).rejects.toEqual(err);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('selectExpiredEndpoints', () => {
  const subs = [
    { endpoint: 'https://push/1' },
    { endpoint: 'https://push/2' },
    { endpoint: 'https://push/3' },
  ];

  it('returns only endpoints the push service reported gone (HTTP 410)', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: { statusCode: 410 } },
      { status: 'rejected', reason: { statusCode: 500 } },
    ];
    expect(selectExpiredEndpoints(results, subs)).toEqual(['https://push/2']);
  });

  it('never deletes valid subscriptions when all sends succeed', () => {
    const results: PromiseSettledResult<unknown>[] = subs.map(() => ({
      status: 'fulfilled' as const,
      value: undefined,
    }));
    expect(selectExpiredEndpoints(results, subs)).toEqual([]);
  });

  it('tolerates a null/odd rejection reason without throwing', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'rejected', reason: null },
      { status: 'rejected', reason: 'boom' },
      { status: 'fulfilled', value: undefined },
    ];
    expect(selectExpiredEndpoints(results, subs)).toEqual([]);
  });
});
