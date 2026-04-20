/**
 * Chainable Supabase query mock.
 *
 * Supports every pattern used in this codebase:
 *   await supabase.from('t').select('*').eq('k', v).order('c')   — direct await
 *   await supabase.from('t').insert({}).select().single()          — .single()
 *   await supabase.from('t').select('*').eq(...).maybeSingle()    — .maybeSingle()
 *   await supabase.from('t').update({}).eq('id', id)              — direct await
 *   await supabase.from('t').delete().eq('id', id)                — direct await
 *   await supabase.from('t').upsert({}, {onConflict: '...'})      — direct await
 *
 * Usage:
 *   mockFrom.mockReturnValue(dbResult({ data: [...], error: null }))
 *   mockFrom.mockReturnValueOnce(dbResult({ data: null, error: { message: 'fail' } }))
 */
export function dbResult(result: { data: unknown; error: unknown }) {
  const p = Promise.resolve(result);

  // The chain object is both a thenable (for direct `await`) and carries all
  // method calls that return itself so chaining works to any depth.
  const chain: Record<string, unknown> = {
    // Direct-await support
    then: (res: Parameters<Promise<unknown>['then']>[0], rej: Parameters<Promise<unknown>['then']>[1]) =>
      p.then(res, rej),
    catch: (rej: Parameters<Promise<unknown>['catch']>[0]) => p.catch(rej),
    finally: (fn: Parameters<Promise<unknown>['finally']>[0]) => p.finally(fn),

    // Terminal methods
    single: jest.fn(() => p),
    maybeSingle: jest.fn(() => p),
  };

  // Every chainable method returns the same chain object.
  for (const m of ['select', 'eq', 'neq', 'or', 'order', 'limit', 'update', 'delete', 'upsert']) {
    chain[m] = jest.fn(() => chain);
  }

  // insert returns a sub-chain that exposes .select().single()
  chain['insert'] = jest.fn(() => ({
    select: jest.fn(() => ({
      single: jest.fn(() => p),
    })),
    then: (res: Parameters<Promise<unknown>['then']>[0], rej: Parameters<Promise<unknown>['then']>[1]) =>
      p.then(res, rej),
    catch: (rej: Parameters<Promise<unknown>['catch']>[0]) => p.catch(rej),
  }));

  return chain;
}

/** Convenience: successful response with data */
export const ok = (data: unknown = null) => dbResult({ data, error: null });

/** Convenience: failed response with error message */
export const fail = (message: string) => dbResult({ data: null, error: { message } });
