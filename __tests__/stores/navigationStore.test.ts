/**
 * QA — navigationStore
 *
 * The app is one hidden Tabs navigator. Back walks a history that differs by
 * platform, so the model is enforced on both:
 *  • WEB: navigateToBase pushes from Home, replaces otherwise → the browser
 *    history stays [home, section].
 *  • NATIVE: TabHistoryBridge resets the tab navigator's own history to
 *    [home, section] whenever a section is focused (collapseHistoryForBase), so
 *    back returns Home regardless of how the section was reached.
 *
 * Covers:
 *  • setCurrentTab / isOnHome, navigateToBase, goBack — the web/imperative side
 *  • isBaseTab / computeBaseHistory / collapseHistoryForBase — the native reset
 *  • end-to-end against the REAL expo-router tab router: a flow → section jump
 *    still lands Home once the bridge collapse is applied.
 */

import { TabRouter, CommonActions } from '@react-navigation/routers';
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { tabRouterOverride } = require('expo-router/build/layouts/TabRouter');
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

import {
  HOME_ROUTE,
  HOME_TAB_NAME,
  isOnHome,
  isBaseTab,
  computeBaseHistory,
  collapseHistoryForBase,
  setCurrentTab,
  navigateToBase,
  goBack,
} from '@stores/navigationStore';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]): void => mockPush(...a),
    replace: (...a: unknown[]): void => mockReplace(...a),
    back: (...a: unknown[]): void => mockBack(...a),
    canGoBack: (): boolean => mockCanGoBack(),
  },
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockBack.mockClear();
  setCurrentTab('dashboard/index');
});

describe('isOnHome', () => {
  it('is true on the home tab and before any tab is known', () => {
    setCurrentTab('dashboard/index');
    expect(isOnHome()).toBe(true);
  });
  it('is false on any other section', () => {
    setCurrentTab('bills/index');
    expect(isOnHome()).toBe(false);
  });
});

describe('navigateToBase (web history)', () => {
  it('pushes when on Home (keeps Home underneath)', () => {
    setCurrentTab('dashboard/index');
    navigateToBase('/(tabs)/chores');
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/chores');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces when on another section (sections never stack)', () => {
    setCurrentTab('chores/index');
    navigateToBase('/(tabs)/bills');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/bills');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('replaces when inside a section flow', () => {
    setCurrentTab('bills/add');
    navigateToBase('/(tabs)/calendar');
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/calendar');
  });
});

describe('goBack', () => {
  it('goes back one level when possible', () => {
    mockCanGoBack.mockReturnValue(true);
    expect(goBack()).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
  it('collapses to home at the root', () => {
    mockCanGoBack.mockReturnValue(false);
    expect(goBack()).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith(HOME_ROUTE);
  });
});

describe('isBaseTab', () => {
  it('treats feature index screens and the settings hub as bases', () => {
    ['dashboard/index', 'bills/index', 'calendar/index', 'more/settings'].forEach((n) =>
      expect(isBaseTab(n)).toBe(true)
    );
  });
  it('treats flows as non-base', () => {
    ['bills/add', 'bills/[id]', 'settings/language', 'grocery/shop'].forEach((n) =>
      expect(isBaseTab(n)).toBe(false)
    );
  });
});

describe('computeBaseHistory', () => {
  it('leaves [home] for home and [home, base] otherwise', () => {
    expect(computeBaseHistory(HOME_TAB_NAME, 'd', 'd')).toEqual([{ type: 'route', key: 'd' }]);
    expect(computeBaseHistory('bills/index', 'd', 'b')).toEqual([
      { type: 'route', key: 'd' },
      { type: 'route', key: 'b' },
    ]);
  });
});

describe('collapseHistoryForBase (native reset)', () => {
  const routes = [
    { name: 'dashboard/index', key: 'd' },
    { name: 'bills/index', key: 'b' },
    { name: 'bills/add', key: 'add' },
    { name: 'calendar/index', key: 'c' },
  ];
  const idx = (name: string): number => routes.findIndex((r) => r.name === name);

  it('collapses a focused section with accumulated history to [home, section]', () => {
    const history = [{ key: 'd' }, { key: 'b' }, { key: 'add' }, { key: 'c' }];
    expect(collapseHistoryForBase(routes, idx('calendar/index'), history)).toEqual([
      { type: 'route', key: 'd' },
      { type: 'route', key: 'c' },
    ]);
  });
  it('leaves a flow page untouched (null)', () => {
    const history = [{ key: 'd' }, { key: 'b' }, { key: 'add' }];
    expect(collapseHistoryForBase(routes, idx('bills/add'), history)).toBeNull();
  });
  it('is a no-op when a section already sits on [home, section]', () => {
    expect(
      collapseHistoryForBase(routes, idx('bills/index'), [{ key: 'd' }, { key: 'b' }])
    ).toBeNull();
  });
});

describe('end-to-end with the real expo-router tab router', () => {
  // route order that would break the raw REPLACE override (calendar after a flow)
  const routeNames = ['dashboard/index', 'bills/index', 'bills/add', 'calendar/index'];
  const opts = { routeNames, routeParamList: {}, routeGetIdList: {} } as never;
  const router = tabRouterOverride(TabRouter({ backBehavior: 'history' }));

  type S = {
    routes: { name: string; key: string }[];
    index: number;
    history?: { key: string }[];
    key: string;
  };
  const nav = (s: S, name: string): S =>
    (router.getStateForAction(s as never, CommonActions.navigate({ name }) as never, opts) ??
      s) as S;

  it('flow → section: the bridge collapse makes back land on Home', () => {
    // Home → bills → bills/add (flow) → calendar (section)
    let s = router.getInitialState(opts) as S;
    s = nav(s, 'bills/index');
    s = nav(s, 'bills/add');
    s = nav(s, 'calendar/index');

    // The bridge resets the focused section's history to [home, section]…
    const desired = collapseHistoryForBase(s.routes, s.index, s.history);
    if (!desired) throw new Error('expected a collapse for the focused section');
    s = router.getStateForAction(
      s as never,
      { ...CommonActions.reset({ ...s, history: desired }), target: s.key } as never,
      opts
    ) as S;

    // …so back goes straight Home, not to the previous section/flow.
    const back = router.getStateForAction(
      s as never,
      CommonActions.goBack() as never,
      opts
    ) as S | null;
    expect(back && back.routes[back.index].name).toBe('dashboard/index');
  });
});
