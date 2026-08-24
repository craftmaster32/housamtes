/**
 * QA — navigationStore
 *
 * Locks in the "base page" back model:
 *  • Base pages (bills, calendar, chores, settings…) collapse the stack to
 *    [home, base] — switching between bases never accumulates, so back from a
 *    base always returns home.
 *  • Flow pages (add / edit / detail / settings sub-pages) stack on top of the
 *    current base, so back returns to that base, then home.
 *  • The user's reported bug: bills/add → chores → calendar → back must land on
 *    home, not retrace calendar → chores → bills/add.
 */

import {
  HOME_ROUTE,
  isBaseRoute,
  normalizePath,
  reduceStack,
  backTarget,
  stackAfterBack,
  useNavigationStore,
} from '../../stores/navigationStore';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    navigate: (...a: unknown[]): void => mockNavigate(...a),
  },
}));

// Replay a sequence of navigations through the pure reducer.
function run(paths: string[], start: string[] = []): string[] {
  return paths.reduce((stack, p) => reduceStack(stack, p), start);
}

describe('normalizePath', () => {
  it('strips query strings and trailing slashes', () => {
    expect(normalizePath('/bills/')).toBe('/bills');
    expect(normalizePath('/bills?tab=open')).toBe('/bills');
    expect(normalizePath('/settings/language/')).toBe('/settings/language');
  });
  it('resolves the empty root to home', () => {
    expect(normalizePath('/')).toBe(HOME_ROUTE);
    expect(normalizePath('')).toBe(HOME_ROUTE);
  });
});

describe('isBaseRoute', () => {
  it('recognises main destinations as base pages', () => {
    ['/dashboard', '/bills', '/calendar', '/chores', '/more/settings'].forEach((p) =>
      expect(isBaseRoute(p)).toBe(true)
    );
  });
  it('treats add / edit / detail / sub-settings as flows, not bases', () => {
    [
      '/bills/add',
      '/bills/123',
      '/settings/language',
      '/grocery/shop',
      '/profile/spending',
    ].forEach((p) => expect(isBaseRoute(p)).toBe(false));
  });
});

describe('reduceStack — base pages collapse', () => {
  it('starts a fresh stack at [home, base]', () => {
    expect(reduceStack([], '/bills')).toEqual([HOME_ROUTE, '/bills']);
  });
  it('landing on home alone keeps just [home]', () => {
    expect(reduceStack([], HOME_ROUTE)).toEqual([HOME_ROUTE]);
  });
  it('switching base drops the previous base and its flow', () => {
    const afterBillsFlow = run(['/bills', '/bills/add']);
    expect(afterBillsFlow).toEqual([HOME_ROUTE, '/bills', '/bills/add']);
    // Now switch to a different base → previous base + flow are gone.
    expect(reduceStack(afterBillsFlow, '/calendar')).toEqual([HOME_ROUTE, '/calendar']);
  });
});

describe('reduceStack — flow pages stack on the base', () => {
  it('pushes a flow on top of its base', () => {
    expect(run(['/calendar', '/calendar/x'])).toEqual([HOME_ROUTE, '/calendar', '/calendar/x']);
  });
  it('keeps multi-level flows within a base', () => {
    expect(run(['/bills', '/bills/add', '/bills/123'])).toEqual([
      HOME_ROUTE,
      '/bills',
      '/bills/add',
      '/bills/123',
    ]);
  });
  it('a flow launched from home sits directly on home', () => {
    // e.g. the "+" add-bill button pressed from the dashboard
    expect(run(['/bills/add'])).toEqual([HOME_ROUTE, '/bills/add']);
  });
});

describe('reduceStack — returning to an ancestor truncates', () => {
  it('tapping the active base tab pops its flow', () => {
    const stack = run(['/calendar', '/calendar/x']);
    expect(reduceStack(stack, '/calendar')).toEqual([HOME_ROUTE, '/calendar']);
  });
  it('navigating home truncates to [home]', () => {
    const stack = run(['/bills', '/bills/add']);
    expect(reduceStack(stack, HOME_ROUTE)).toEqual([HOME_ROUTE]);
  });
  it('re-navigating to the same screen is a no-op', () => {
    const stack = run(['/bills']);
    expect(reduceStack(stack, '/bills')).toBe(stack);
  });
});

describe('backTarget / stackAfterBack', () => {
  it('returns null at the root and does not pop past it', () => {
    expect(backTarget([HOME_ROUTE])).toBeNull();
    expect(stackAfterBack([HOME_ROUTE])).toEqual([HOME_ROUTE]);
  });
  it('points one level down and pops one level', () => {
    const stack = [HOME_ROUTE, '/chores', '/chores/edit'];
    expect(backTarget(stack)).toBe('/chores');
    expect(stackAfterBack(stack)).toEqual([HOME_ROUTE, '/chores']);
  });
});

describe('user scenario — bills/add → chores → calendar → back lands home', () => {
  it('does not retrace the previous bases', () => {
    let stack = run(['/bills/add', '/chores', '/calendar']);
    expect(stack).toEqual([HOME_ROUTE, '/calendar']);
    // back → home (not chores, not bills/add)
    expect(backTarget(stack)).toBe(HOME_ROUTE);
    stack = stackAfterBack(stack);
    expect(stack).toEqual([HOME_ROUTE]);
  });
});

describe('user scenario — calendar flow, then chores edit', () => {
  it('back from the chores edit lands on chores, then home', () => {
    // calendar → (add event) → switch to chores → (edit chore)
    let stack = run(['/calendar', '/calendar/add', '/chores', '/chores/edit']);
    expect(stack).toEqual([HOME_ROUTE, '/chores', '/chores/edit']);
    // back → chores base
    expect(backTarget(stack)).toBe('/chores');
    stack = stackAfterBack(stack);
    // back again → home; the earlier calendar flow is gone
    expect(backTarget(stack)).toBe(HOME_ROUTE);
    expect(stackAfterBack(stack)).toEqual([HOME_ROUTE]);
  });
});

describe('store: sync + goBack', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useNavigationStore.getState().reset();
  });

  it('tracks navigation via sync and walks back through the stack', () => {
    const { sync } = useNavigationStore.getState();
    sync('/bills');
    sync('/bills/add');
    expect(useNavigationStore.getState().stack).toEqual([HOME_ROUTE, '/bills', '/bills/add']);

    const moved = useNavigationStore.getState().goBack();
    expect(moved).toBe(true);
    // Navigates with the (tabs)-qualified href the app uses.
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/bills');
    expect(useNavigationStore.getState().stack).toEqual([HOME_ROUTE, '/bills']);
  });

  it('goBack returns false at home and does not navigate', () => {
    expect(useNavigationStore.getState().stack).toEqual([HOME_ROUTE]);
    expect(useNavigationStore.getState().goBack()).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('after goBack, sync to the target is a no-op (no double processing)', () => {
    const store = useNavigationStore.getState();
    store.sync('/chores');
    store.sync('/chores/edit');
    store.goBack(); // → /chores
    const before = useNavigationStore.getState().stack;
    store.sync('/chores'); // pathname settles on the target
    expect(useNavigationStore.getState().stack).toBe(before);
  });
});
