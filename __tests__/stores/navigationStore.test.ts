/**
 * QA — navigationStore
 *
 * The app is one hidden Tabs navigator; every navigation appends to history, and
 * back (in-app arrow, edge-swipe, hardware button, or the browser's own back on
 * web) walks that history. To stop sections accumulating, opening a section
 * pushes from Home but REPLACES from anywhere else, so history stays
 * [home, section] and back from any section returns Home.
 *
 * Covers:
 *  • setCurrentTab / isOnHome — the focused-tab tracking
 *  • navigateToBase — push from home, replace otherwise
 *  • goBack — one level back, home at the root
 *  • end-to-end against the REAL expo-router tab router (with its REPLACE
 *    override): "chores → bills → calendar → back" now lands on Home.
 */

import { TabRouter, CommonActions } from '@react-navigation/routers';
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const { tabRouterOverride } = require('expo-router/build/layouts/TabRouter');
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */

import {
  HOME_ROUTE,
  isOnHome,
  setCurrentTab,
  navigateToBase,
  goBack,
} from '../../stores/navigationStore';

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

describe('navigateToBase', () => {
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

describe('end-to-end with the real expo-router tab router', () => {
  it('chores → bills → calendar → back lands on Home (no retrace)', () => {
    const routeNames = ['dashboard/index', 'chores/index', 'bills/index', 'calendar/index'];
    const opts = { routeNames, routeParamList: {}, routeGetIdList: {} } as never;
    // expo-router wraps the tab router with a REPLACE override; use the real one.
    const router = tabRouterOverride(TabRouter({ backBehavior: 'history' }));

    type S = { routes: { name: string; key: string }[]; index: number; key: string };
    const push = (s: S, name: string): S =>
      (router.getStateForAction(s as never, CommonActions.navigate({ name }) as never, opts) ??
        s) as S;
    const replace = (s: S, name: string): S =>
      (router.getStateForAction(
        s as never,
        { type: 'REPLACE', target: s.key, payload: { name, params: {} } } as never,
        opts
      ) ?? s) as S;

    let s = router.getInitialState(opts) as S;
    s = push(s, 'chores/index'); // from Home → push
    s = replace(s, 'bills/index'); // from a section → replace
    s = replace(s, 'calendar/index'); // from a section → replace

    const back = router.getStateForAction(
      s as never,
      CommonActions.goBack() as never,
      opts
    ) as S | null;
    expect(back && back.routes[back.index].name).toBe('dashboard/index');
  });
});
