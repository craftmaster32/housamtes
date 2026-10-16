// The Edge Function runs on Deno (URL imports, `.ts` import paths), which the
// app's TypeScript check can't follow — so load it at runtime and describe
// just the two functions under test here.
type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;

interface StaleItemsModule {
  runStaleItemCheck: (
    supabase: FakeSupabase,
    now?: Date
  ) => Promise<{ sent: number; items: number }>;
}
// The shared push sender imports web-push the Deno way ('npm:…'); Jest can't
// resolve that, and these tests only exercise native (Expo) delivery.
jest.mock(
  'npm:web-push@3.6.7',
  () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn() }),
  {
    virtual: true,
  }
);

const { runStaleItemCheck } = jest.requireActual<StaleItemsModule>(
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
  range: (from: number, to: number) => Query;
}
interface FakeSupabase {
  from: (table: string) => Query;
  rpc: (fn: string, args: Row) => Query;
}

function fakeSupabase(db: Db): FakeSupabase {
  return {
    // Stands in for grocery_stale_candidates: same item filters and per-house
    // cap. Its daytime/cooldown rules are SQL and were verified on Postgres.
    rpc(_fn: string, args: Row): Query {
      const perHouse = args.p_per_house as number;
      const seen = new Map<unknown, number>();
      const rows = (db.grocery_items ?? [])
        .filter(
          (r) =>
            r.stale_notified_at == null &&
            !r.is_checked &&
            !r.is_draft &&
            String(r.created_at) <= String(args.p_cutoff)
        )
        .sort((a, b) => String(a.house_id).localeCompare(String(b.house_id)))
        .filter((r) => {
          const n = (seen.get(r.house_id) ?? 0) + 1;
          seen.set(r.house_id, n);
          return n <= perHouse;
        });
      db.__candidates = rows;
      return this.from('__candidates');
    },
    from(table: string): Query {
      const filters: Array<(r: Row) => boolean> = [];
      let patch: Row | null = null;
      let offset = 0;
      let limit = Infinity;
      const run = (): { data: Row[]; error: null } => {
        const rows = (db[table] ?? []).filter((r) => filters.every((f) => f(r)));
        if (patch) rows.forEach((r) => Object.assign(r, patch));
        const page = rows.slice(offset, offset + limit);
        return { data: page.map((r) => ({ ...r })), error: null };
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
        range: (from, to) => {
          offset = from;
          limit = to - from + 1;
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

// Expo answers 200 with one ticket per message.
const expoReply =
  (status: 'ok' | 'error') =>
  async (_url: string, init: { body: string }): Promise<unknown> => ({
    ok: true,
    json: async () => ({
      data: (JSON.parse(init.body) as unknown[]).map(() => ({ status })),
    }),
  });

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(expoReply('ok'));
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

  it('keeps the item eligible when nobody can be reached yet', async () => {
    const db = baseDb([item('Milk')], { push_tokens: [] });
    expect(await run(db)).toEqual({ sent: 0, items: 0 });
    expect(db.grocery_items[0].stale_notified_at).toBeNull();
  });

  it('retires items in a house nobody lives in any more', async () => {
    const db = baseDb([item('Milk')], { house_members: [] });
    await run(db);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.grocery_items[0].stale_notified_at).toBe(NOW.toISOString());
  });

  it('caps each house and still reaches every house across pages', async () => {
    // 60 houses × 25 old items: 20 per house = 1,200 candidates, two pages.
    const houses = Array.from({ length: 60 }, (_, n) => `house-${String(n).padStart(2, '0')}`);
    const items = houses.flatMap((h) =>
      Array.from({ length: 25 }, (_, n) => item(`${h}-${n}`, { house_id: h }))
    );
    const db = baseDb(items, {
      house_members: houses.map((h) => ({ house_id: h, user_id: `u-${h}` })),
      push_tokens: houses.map((h) => ({ house_id: h, user_id: `u-${h}`, token: `t-${h}` })),
    });

    const result = await run(db);

    expect(result.items).toBe(1200);
    expect(new Set(pushes().map((p) => p.to)).size).toBe(60);
  });

  it('releases the claim when Expo answers 200 but rejects every message', async () => {
    fetchMock.mockImplementation(expoReply('error'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = baseDb([item('Milk')]);
    const result = await run(db);
    expect(result.sent).toBe(0);
    expect(db.grocery_items[0].stale_notified_at).toBeNull();
  }, 10000);

  it('releases the claim when the push fails so the next run retries', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = baseDb([item('Milk')]);
    const result = await run(db);
    expect(result.sent).toBe(0);
    expect(db.grocery_items[0].stale_notified_at).toBeNull();
  }, 10000);
});
