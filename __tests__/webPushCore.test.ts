import { dedupeUserIds, selectExpiredEndpoints } from '../supabase/functions/_shared/webPushCore';

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
