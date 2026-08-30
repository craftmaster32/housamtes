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
  isBaseRoute,
  SETTINGS_TAB_NAME,
  computeBaseHistory,
  collapseHistoryForBase,
  setCurrentTab,
  navigateToBase,
  goBack,
  sectionOfTab,
  hrefToTabName,
  planBaseNavigation,
  resetTabTracking,
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
  resetTabTracking();
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

describe('sectionOfTab', () => {
  it('maps a flow to the section it hangs off', () => {
    expect(sectionOfTab('bills/[id]')).toBe('bills/index');
    expect(sectionOfTab('bills/add')).toBe('bills/index');
    expect(sectionOfTab('grocery/shop')).toBe('grocery/index');
    expect(sectionOfTab('profile/spending')).toBe('profile/index');
    expect(sectionOfTab('more/chat')).toBe('more/index');
  });
  it('hangs settings sub-pages off the Settings hub, not a settings index', () => {
    expect(sectionOfTab('settings/language')).toBe('more/settings');
    expect(sectionOfTab('settings/categories')).toBe('more/settings');
  });
});

describe('hrefToTabName', () => {
  it('normalises base hrefs to their tab route name', () => {
    expect(hrefToTabName('/(tabs)/bills')).toBe('bills/index');
    expect(hrefToTabName('/(tabs)/bills/index')).toBe('bills/index');
    expect(hrefToTabName('/(tabs)/more/settings')).toBe('more/settings');
    expect(hrefToTabName('/(tabs)/dashboard')).toBe(HOME_TAB_NAME);
  });
  it('ignores query strings', () => {
    expect(hrefToTabName('/(tabs)/bills?openRecurring=1')).toBe('bills/index');
  });
});

describe('planBaseNavigation', () => {
  const H = HOME_TAB_NAME;
  it('pushes from Home so Home stays underneath', () => {
    expect(planBaseNavigation([H], true, 'bills/index')).toEqual({ pops: 0, replace: false });
  });
  it('replaces between sections so they never stack', () => {
    expect(planBaseNavigation([H, 'chores/index'], true, 'bills/index')).toEqual({
      pops: 0,
      replace: true,
    });
  });
  it('unwinds straight to a target already below the flow', () => {
    // Bills → bill detail → Bills: one pop lands on the Bills already underneath.
    expect(planBaseNavigation([H, 'bills/index', 'bills/[id]'], false, 'bills/index')).toEqual({
      pops: 1,
      replace: false,
    });
  });
  it('unwinds a deep flow chain in one move', () => {
    // Bills → bill → a settings sub-page opened from it, then back to Bills.
    const stack = [H, 'bills/index', 'bills/[id]', 'settings/categories'];
    expect(planBaseNavigation(stack, false, 'bills/index')).toEqual({ pops: 2, replace: false });
  });
  it('unwinds to the section then swaps it when leaving for another', () => {
    expect(planBaseNavigation([H, 'bills/index', 'bills/[id]'], false, 'chores/index')).toEqual({
      pops: 1,
      replace: true,
    });
  });
  it('swaps in place for a flow sitting directly on Home', () => {
    // A bill opened straight from the dashboard has no section under it.
    expect(planBaseNavigation([H, 'bills/[id]'], false, 'bills/index')).toEqual({
      pops: 0,
      replace: true,
    });
  });
});

describe('isBaseRoute — Settings is a section or a page of Profile', () => {
  it('is a section when opened from the menu', () => {
    expect(isBaseRoute(SETTINGS_TAB_NAME)).toBe(true);
    expect(isBaseRoute(SETTINGS_TAB_NAME, {})).toBe(true);
  });
  it('is a page of Profile when opened from there', () => {
    expect(isBaseRoute(SETTINGS_TAB_NAME, { from: 'profile' })).toBe(false);
  });
  it('leaves every other route judged by name alone', () => {
    expect(isBaseRoute('bills/index')).toBe(true);
    expect(isBaseRoute('bills/[id]', { from: 'profile' })).toBe(false);
  });
});

describe('web history never accumulates across repeated rounds', () => {
  // A miniature browser history. push appends, replace swaps the top entry, pop
  // drops it — exactly what the real one does, which is the part the old code
  // got wrong: replace left the section a flow was opened from in place.
  type Sim = { entries: string[] };
  const apply = (h: Sim, action: { pops: number; replace: boolean }, target: string): void => {
    for (let i = 0; i < action.pops; i++) h.entries.pop();
    if (action.replace) h.entries[h.entries.length - 1] = target;
    else if (h.entries[h.entries.length - 1] !== target) h.entries.push(target);
  };

  it('bills → bill → bills, three times, still leaves back one step from Home', () => {
    const h: Sim = { entries: [HOME_TAB_NAME] };
    let isBase = true;

    for (let round = 0; round < 3; round++) {
      // …tap Bills in the menu
      apply(h, planBaseNavigation(h.entries, isBase, 'bills/index'), 'bills/index');
      isBase = true;
      // …open a bill (a plain push, as the Bills list does)
      h.entries.push('bills/[id]');
      isBase = false;
    }

    // The old code produced [home, bills, bills, bills, bill] here — one stale
    // Bills per round. The whole point is that this stays flat.
    expect(h.entries).toEqual([HOME_TAB_NAME, 'bills/index', 'bills/[id]']);

    // Back from the bill lands on Bills, and one more back reaches Home.
    h.entries.pop();
    expect(h.entries[h.entries.length - 1]).toBe('bills/index');
    h.entries.pop();
    expect(h.entries).toEqual([HOME_TAB_NAME]);
  });

  it('Settings goes back to Home from the menu, and to Profile from Profile', () => {
    // Opened from the menu it is a section: it sits directly on Home, so one
    // back reaches Home.
    const viaMenu: Sim = { entries: [HOME_TAB_NAME] };
    apply(viaMenu, planBaseNavigation(viaMenu.entries, true, SETTINGS_TAB_NAME), SETTINGS_TAB_NAME);
    expect(viaMenu.entries).toEqual([HOME_TAB_NAME, SETTINGS_TAB_NAME]);
    viaMenu.entries.pop();
    expect(viaMenu.entries[viaMenu.entries.length - 1]).toBe(HOME_TAB_NAME);

    // Opened from Profile it is a page of Profile: pushed on top of it, so back
    // returns to Profile, and the one after that reaches Home.
    const viaProfile: Sim = { entries: [HOME_TAB_NAME] };
    apply(
      viaProfile,
      planBaseNavigation(viaProfile.entries, true, 'profile/index'),
      'profile/index'
    );
    viaProfile.entries.push(SETTINGS_TAB_NAME); // a push, because it is a flow here
    expect(viaProfile.entries).toEqual([HOME_TAB_NAME, 'profile/index', SETTINGS_TAB_NAME]);
    viaProfile.entries.pop();
    expect(viaProfile.entries[viaProfile.entries.length - 1]).toBe('profile/index');
    viaProfile.entries.pop();
    expect(viaProfile.entries).toEqual([HOME_TAB_NAME]);
  });

  it('leaving Settings-from-Profile for a section still lands flat', () => {
    // [home, profile, settings] → tap Bills: unwind both, land on [home, bills].
    const stack = [HOME_TAB_NAME, 'profile/index', SETTINGS_TAB_NAME];
    const h: Sim = { entries: [...stack] };
    // isBase is false here — Settings opened from Profile is a page of Profile.
    apply(h, planBaseNavigation(h.entries, false, 'bills/index'), 'bills/index');
    expect(h.entries).toEqual([HOME_TAB_NAME, 'bills/index']);

    // …and tapping Profile from there returns to the Profile already underneath.
    const back: Sim = { entries: [...stack] };
    apply(back, planBaseNavigation(back.entries, false, 'profile/index'), 'profile/index');
    expect(back.entries).toEqual([HOME_TAB_NAME, 'profile/index']);
  });

  it('holds for every section, not just bills', () => {
    // The rule has to be global: whatever section you are on, and whatever flow
    // you opened inside it, one back reaches the section and the next reaches
    // Home. Nothing may ever sit between a section and Home.
    const sections = [
      'bills/index',
      'chores/index',
      'calendar/index',
      'grocery/index',
      'parking/index',
      'tasks/index',
      'voting/index',
      'notes/index',
      'more/settings',
    ];
    const flowOf: Record<string, string> = {
      'bills/index': 'bills/[id]',
      'chores/index': 'chores/[id]',
      'calendar/index': 'calendar/[id]',
      'grocery/index': 'grocery/shop',
      'parking/index': 'parking/[id]',
      'tasks/index': 'tasks/[id]',
      'voting/index': 'voting/[id]',
      'notes/index': 'notes/[id]',
      'more/settings': 'settings/language',
    };

    const h: Sim = { entries: [HOME_TAB_NAME] };
    let isBase = true;

    for (const section of sections) {
      apply(h, planBaseNavigation(h.entries, isBase, section), section);
      isBase = true;
      // A section always sits directly on Home — never on another section.
      expect(h.entries).toEqual([HOME_TAB_NAME, section]);

      h.entries.push(flowOf[section]);
      isBase = false;
      expect(h.entries).toEqual([HOME_TAB_NAME, section, flowOf[section]]);
    }
  });

  it('stays flat when flows and sections are mixed', () => {
    const h: Sim = { entries: [HOME_TAB_NAME] };
    let isBase = true;
    const toBase = (target: string): void => {
      apply(h, planBaseNavigation(h.entries, isBase, target), target);
      isBase = true;
    };
    const toFlow = (name: string): void => {
      h.entries.push(name);
      isBase = false;
    };

    toBase('bills/index');
    toFlow('bills/[id]');
    toBase('chores/index'); // flow → a different section
    toFlow('grocery/shop');
    toBase('bills/index');
    toFlow('bills/[id]');

    expect(h.entries).toEqual([HOME_TAB_NAME, 'bills/index', 'bills/[id]']);
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
  it('collapses Settings when it is a section, but not when opened from Profile', () => {
    const withSettings = [
      { name: 'dashboard/index', key: 'd' },
      { name: 'profile/index', key: 'p' },
      { name: SETTINGS_TAB_NAME, key: 's' },
    ];
    const history = [{ key: 'd' }, { key: 'p' }, { key: 's' }];
    const settingsAt = 2;

    // From the menu it is a section — collapse so back reaches Home.
    expect(collapseHistoryForBase(withSettings, settingsAt, history)).toEqual([
      { type: 'route', key: 'd' },
      { type: 'route', key: 's' },
    ]);

    // From Profile it is a page of Profile — leave its pushed history alone so
    // back returns to Profile.
    const fromProfile = withSettings.map((r) =>
      r.name === SETTINGS_TAB_NAME ? { ...r, params: { from: 'profile' } } : r
    );
    expect(collapseHistoryForBase(fromProfile, settingsAt, history)).toBeNull();
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

  it('repeated flow round-trips never accumulate history', () => {
    // Bills → open a flow (edit/add) → real pop back to Bills, three times in a
    // row — the "edit a bill, back, edit another" pattern. Screens must return
    // to their section with a real pop (goBack), not router.replace: replace
    // only swaps what's on top, so replaying this round would leave one more
    // stale entry behind each time, and back would have to be pressed once per
    // round before it ever reached Home.
    let s = router.getInitialState(opts) as S;
    s = nav(s, 'bills/index');
    for (let round = 0; round < 3; round++) {
      s = nav(s, 'bills/add');
      s = router.getStateForAction(s as never, CommonActions.goBack() as never, opts) as S;
    }
    expect(s.routes[s.index].name).toBe('bills/index');
    expect(s.history).toHaveLength(2);

    // …so one back from here still goes straight Home, no matter how many
    // rounds were played.
    const back = router.getStateForAction(
      s as never,
      CommonActions.goBack() as never,
      opts
    ) as S | null;
    expect(back && back.routes[back.index].name).toBe('dashboard/index');
  });
});
