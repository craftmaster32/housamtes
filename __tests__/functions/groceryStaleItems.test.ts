// The Edge Function runs on Deno (URL imports, `.ts` import paths), which the
// app's TypeScript check can't follow — so load it at runtime and describe
// just the two functions under test here.
type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

interface StaleItemsModule {
  localHour: (tz: string, now: Date) => number | null;
  runStaleItemCheck: (
    supabase: FakeSupabase,
    now?: Date
  ) => Promise<{ sent: number; items: number }>;
}
const { localHour, runStaleItemCheck } = jest.requireActual<StaleItemsModule>(
  '../../supabase/functions/grocery-reminder-check/staleItems'
);

// A tiny in-memory stand-in for the Supabase query builder — just the filters
// the stale check uses — so we test the real rules end to end.
interface Query extends PromiseLike<{ data: Row[]; error: null }> {
  select: () => Query;
  update: (p: Row) => Query;
  eq: (k: string, v: unknown) => Query;
  is: (k: string, v: unknown) => Query;
  in: (k: string, vs: unknown[]) => Query;
  lte: (k: string, v: string) => Query;
  gte: (k: string, v: string) => Query;
  order: () => Query;
  limit: (n: number) => Query;
}
interface FakeSupabase {
  from: (table: string) => Query;
}

function fakeSupabase(db: Db): FakeSupabase {
  return {
    from(table: string): Query {
      const filters: Array<(r: Row) => boolean> = [];
      let patch: Row | null = null;
      let limit = Infinity;
      const run = (): { data: Row[]; error: null } => {
        const rows = (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
        if (patch) rows.forEach((r) => Object.assign(r, patch));
        return { data: rows.slice(0, limit).map((r) => ({ ...r })), error: null };
      };
      const where = (f: (r: Row) => boolean): Query => {
        filters.push(f);
        return q;
      };
      const q: Query = {
        select: () => q,
        update: (p) => {
          patch = p;
          return q;
        },
        eq: (k, v) => where((r) => r[k] === v),
        is: (k, v) => where((r) => (r[k] ?? null) === v),
        in: (k, vs) => where((r) => vs.includes(r[k])),
        lte: (k, v) => where((r) => String(r[k]) <= v),
        gte: (k, v) => where((r) => r[k] != null && String(r[k]) >= v),
        order: () => q,
        limit: (n) => {
          limit = n;
          return q;
        },
        then: (res, rej) => Promise.resolve(run()).then(res, rej),
      };
      return q;
    },
  };
}

// 12:00 UTC = 15:00 in Jerusalem (daytime), 05:00 in Los Angeles (night).
const NOW = new Date('2026-10-11T12:00:00Z');
const daysAgo = (d: number): string => new Date(NOW.getTime() - d * 86400000).toISOString();

function item(id: string, over: Row = {}): Row {
  return {
    id,
    house_id: 'h1',
    name: id,
    added_by: 'alice',
    is_personal: false,
    is_draft: false,
    is_checked: false,
    created_at: daysAgo(4),
    stale_notified_at: null,
    ...over,
  };
}

function baseDb(items: Row[], extra: Partial<Db> = {}): Db {
  return {
    grocery_items: items,
    houses: [{ id: 'h1', timezone: 'Asia/Jerusalem' }],
    house_members: [
      { house_id: 'h1', user_id: 'alice' },
      { house_id: 'h1', user_id: 'bob' },
    ],
    push_tokens: [
      { house_id: 'h1', user_id: 'alice', token: 'tok-alice', language: 'en' },
      { house_id: 'h1', user_id: 'bob', token: 'tok-bob', language: 'he' },
    ],
    notification_preferences: [],
    ...extra,
  };
}

const fetchMock = jest.fn();
type Push = { to: string; body: string };
const pushes = (): Push[] => fetchMock.mock.calls.flatMap((c) => JSON.parse(c[1].body) as Push[]);

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  global.fetch = fetchMock as unknown as typeof fetch;
});

const run = (db: Db): Promise<{ sent: number; items: number }> =>
  runStaleItemCheck(fakeSupabase(db), NOW);

describe('stale grocery nudge', () => {
  it('nudges every housemate once about shared items waiting 3+ days', async () => {
    const db = baseDb([item('Milk'), item('Eggs', { created_at: daysAgo(1) })]);

    const result = await run(db);

    expect(result).toEqual({ sent: 2, items: 1 });
    expect(
      pushes()
        .map((p) => p.to)
        .sort()
    ).toEqual(['tok-alice', 'tok-bob']);
    expect(pushes().find((p) => p.to === 'tok-alice')?.body).toContain('Milk has been waiting');
    expect(db.grocery_items[0].stale_notified_at).toBe(NOW.toISOString());
    expect(db.grocery_items[1].stale_notified_at).toBeNull(); // only 1 day old

    // Running again doesn't repeat the nudge.
    fetchMock.mockClear();
    await run(db);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips ticked items and drafts', async () => {
    const db = baseDb([item('Ticked', { is_checked: true }), item('Draft', { is_draft: true })]);
    expect(await run(db)).toEqual({ sent: 0, items: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('only tells the owner about their private items', async () => {
    const db = baseDb([item('Vitamins', { is_personal: true, added_by: 'bob' })]);
    await run(db);
    expect(pushes().map((p) => p.to)).toEqual(['tok-bob']);
  });

  it('respects the mute switch', async () => {
    const db = baseDb([item('Milk')], {
      notification_preferences: [{ house_id: 'h1', user_id: 'bob', notify_grocery_stale: false }],
    });
    await run(db);
    expect(pushes().map((p) => p.to)).toEqual(['tok-alice']);
  });

  it('waits for daytime in the house’s timezone', async () => {
    const db = baseDb([item('Milk')], { houses: [{ id: 'h1', timezone: 'America/Los_Angeles' }] });
    expect(await run(db)).toEqual({ sent: 0, items: 0 });
    expect(db.grocery_items[0].stale_notified_at).toBeNull(); // picked up later in the day
  });

  it('sends at most one nudge per house per day', async () => {
    const earlier = new Date(NOW.getTime() - 3 * 3600000).toISOString();
    const db = baseDb([item('Old', { stale_notified_at: earlier }), item('Milk')]);
    expect(await run(db)).toEqual({ sent: 0, items: 0 });
    expect(db.grocery_items[1].stale_notified_at).toBeNull();
  });

  it('releases the claim when the push fails so the next run retries', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = baseDb([item('Milk')]);
    const result = await run(db);
    expect(result.sent).toBe(0);
    expect(db.grocery_items[0].stale_notified_at).toBeNull();
  }, 10000);
});

describe('localHour', () => {
  it('reads the hour in the given timezone and rejects bad ones', () => {
    expect(localHour('UTC', NOW)).toBe(12);
    expect(localHour('Not/AZone', NOW)).toBeNull();
  });
});
