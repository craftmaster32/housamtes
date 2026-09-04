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
