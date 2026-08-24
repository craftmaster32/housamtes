/**
 * QA — navigationStore
 *
 * The app is one hidden Tabs navigator; back walks the tab navigator's internal
 * `history`. TabHistoryBridge collapses that history to [home, base] whenever a
 * base (main section) tab becomes focused, so back from any section returns home.
 *
 * Covers:
 *  • isBaseTab — which route names are base pages vs flows
 *  • computeBaseHistory — the [home] / [home, base] history a base leaves behind
 *  • collapseHistoryForBase — the pure decision the bridge applies (null = leave)
 *  • goBack / navigateToBase — imperative helpers
 *  • end-to-end against the REAL TabRouter: the reported "chores → bills →
 *    calendar → back" retrace now lands on home.
 */

import { TabRouter, CommonActions } from '@react-navigation/routers';
import {
  HOME_TAB_NAME,
  isBaseTab,
  computeBaseHistory,
  collapseHistoryForBase,
  navigateToBase,
  goBack,
} from '../../stores/navigationStore';

const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    navigate: (...a: unknown[]): void => mockNavigate(...a),
    back: (...a: unknown[]): void => mockBack(...a),
    canGoBack: (): boolean => mockCanGoBack(),
  },
}));

const ROUTES = [
  { name: 'dashboard/index', key: 'd' },
  { name: 'chores/index', key: 'ch' },
  { name: 'bills/index', key: 'b' },
  { name: 'calendar/index', key: 'c' },
  { name: 'bills/add', key: 'add' },
  { name: 'more/settings', key: 'set' },
];
const idxOf = (name: string): number => ROUTES.findIndex((r) => r.name === name);

describe('isBaseTab', () => {
  it('treats feature index screens and the settings hub as bases', () => {
    ['dashboard/index', 'bills/index', 'calendar/index', 'chores/index', 'more/settings'].forEach(
      (n) => expect(isBaseTab(n)).toBe(true)
    );
  });
  it('treats add / edit / detail / sub-settings as flows', () => {
    ['bills/add', 'bills/[id]', 'settings/language', 'grocery/shop', 'profile/spending'].forEach(
      (n) => expect(isBaseTab(n)).toBe(false)
    );
  });
});

describe('computeBaseHistory', () => {
  it('leaves just [home] for the home tab', () => {
    expect(computeBaseHistory(HOME_TAB_NAME, 'd', 'd')).toEqual([{ type: 'route', key: 'd' }]);
  });
  it('leaves [home, base] for any other base', () => {
    expect(computeBaseHistory('calendar/index', 'd', 'c')).toEqual([
      { type: 'route', key: 'd' },
      { type: 'route', key: 'c' },
    ]);
  });
});

describe('collapseHistoryForBase', () => {
  it('collapses to [home, base] when a base is focused with accumulated history', () => {
    // history: dashboard → chores → bills → calendar (focused calendar)
    const history = [{ key: 'd' }, { key: 'ch' }, { key: 'b' }, { key: 'c' }];
    expect(collapseHistoryForBase(ROUTES, idxOf('calendar/index'), history)).toEqual([
      { type: 'route', key: 'd' },
      { type: 'route', key: 'c' },
    ]);
  });

  it('leaves flow pages alone (returns null)', () => {
    const history = [{ key: 'd' }, { key: 'b' }, { key: 'add' }];
    expect(collapseHistoryForBase(ROUTES, idxOf('bills/add'), history)).toBeNull();
  });

  it('is a no-op when a base already sits on [home, base]', () => {
    const history = [{ key: 'd' }, { key: 'b' }];
    expect(collapseHistoryForBase(ROUTES, idxOf('bills/index'), history)).toBeNull();
  });

  it('collapses home itself to [home]', () => {
    const history = [{ key: 'd' }, { key: 'b' }, { key: 'd' }];
    expect(collapseHistoryForBase(ROUTES, idxOf('dashboard/index'), history)).toEqual([
      { type: 'route', key: 'd' },
    ]);
  });
});

describe('imperative helpers', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockBack.mockClear();
  });

  it('navigateToBase navigates to the href', () => {
    navigateToBase('/(tabs)/bills');
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/bills');
  });

  it('goBack goes back one level when possible', () => {
    mockCanGoBack.mockReturnValue(true);
    expect(goBack()).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('goBack collapses to home when it cannot go back', () => {
    mockCanGoBack.mockReturnValue(false);
    expect(goBack()).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/dashboard');
  });
});

describe('end-to-end with the real TabRouter', () => {
  it('chores → bills → calendar → back lands on home (not a retrace)', () => {
    const routeNames = ['dashboard/index', 'chores/index', 'bills/index', 'calendar/index'];
    const opts = { routeNames, routeParamList: {}, routeGetIdList: {} } as never;
    const router = TabRouter({ backBehavior: 'history' });
    const nav = (s: unknown, name: string): unknown =>
      router.getStateForAction(s as never, CommonActions.navigate({ name }) as never, opts) ?? s;

    // dashboard → chores → bills → calendar
    let state = router.getInitialState(opts) as {
      routes: { name: string; key: string }[];
      index: number;
      history?: { key: string }[];
      key: string;
    };
    state = nav(state, 'chores/index') as typeof state;
    state = nav(state, 'bills/index') as typeof state;
    state = nav(state, 'calendar/index') as typeof state;

    // The bridge computes the collapse for the focused base (calendar)…
    const nextHistory = collapseHistoryForBase(state.routes, state.index, state.history);
    if (!nextHistory) throw new Error('expected a history collapse for a focused base');

    // …and applies it as a reset.
    const afterReset = router.getStateForAction(
      state as never,
      { ...CommonActions.reset({ ...state, history: nextHistory }), target: state.key } as never,
      opts
    ) as typeof state;

    // Back now goes straight home.
    const back = router.getStateForAction(
      afterReset as never,
      CommonActions.goBack() as never,
      opts
    ) as typeof state | null;
    expect(back && back.routes[back.index].name).toBe('dashboard/index');
  });
});
