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
  it('pushes from Home so Home stays underneath', () => {
    expect(planBaseNavigation(null, null, 'bills/index')).toBe('push');
    expect(planBaseNavigation(HOME_TAB_NAME, HOME_TAB_NAME, 'bills/index')).toBe('push');
  });
  it('replaces between sections so they never stack', () => {
    expect(planBaseNavigation('chores/index', 'chores/index', 'bills/index')).toBe('replace');
  });
  it('pops when a flow returns to the section it was opened from', () => {
    // Bills → bill detail → Bills: the Bills entry is already underneath.
    expect(planBaseNavigation('bills/[id]', 'bills/index', 'bills/index')).toBe('pop');
    expect(planBaseNavigation('settings/language', 'more/settings', 'more/settings')).toBe('pop');
  });
  it('pops then replaces when a flow leaves for a different section', () => {
    expect(planBaseNavigation('bills/[id]', 'bills/index', 'chores/index')).toBe('pop-replace');
    // A bill opened from Home pops back to Home, then swaps it for Bills.
    expect(planBaseNavigation('bills/[id]', HOME_TAB_NAME, 'bills/index')).toBe('pop-replace');
  });
});

describe('web history never accumulates across repeated rounds', () => {
  // A miniature browser history. push appends, replace swaps the top entry, pop
  // drops it — exactly what the real one does, which is the part the old code
  // got wrong: replace left the section a flow was opened from in place.
  type Sim = { entries: string[] };
  const apply = (h: Sim, plan: string, target: string): void => {
    if (plan === 'push') h.entries.push(target);
    else if (plan === 'replace') h.entries[h.entries.length - 1] = target;
    else if (plan === 'pop') h.entries.pop();
    else if (plan === 'pop-replace') {
      h.entries.pop();
      h.entries[h.entries.length - 1] = target;
    }
  };

  it('bills → bill → bills, three times, still leaves back one step from Home', () => {
    const h: Sim = { entries: [HOME_TAB_NAME] };
    let current = HOME_TAB_NAME;
    let lastBase = HOME_TAB_NAME;

    for (let round = 0; round < 3; round++) {
      // …tap Bills in the menu
      const plan = planBaseNavigation(current, lastBase, 'bills/index');
      apply(h, plan, 'bills/index');
      current = 'bills/index';
      lastBase = 'bills/index';
      // …open a bill (a plain push, as the Bills list does)
      h.entries.push('bills/[id]');
      current = 'bills/[id]';
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
    let current = HOME_TAB_NAME;
    let lastBase = HOME_TAB_NAME;

    for (const section of sections) {
      apply(h, planBaseNavigation(current, lastBase, section), section);
      current = section;
      lastBase = section;
      // A section always sits directly on Home — never on another section.
      expect(h.entries).toEqual([HOME_TAB_NAME, section]);

      h.entries.push(flowOf[section]);
      current = flowOf[section];
      expect(h.entries).toEqual([HOME_TAB_NAME, section, flowOf[section]]);
    }
  });

  it('stays flat when flows and sections are mixed', () => {
    const h: Sim = { entries: [HOME_TAB_NAME] };
    let current = HOME_TAB_NAME;
    let lastBase = HOME_TAB_NAME;
    const toBase = (target: string): void => {
      apply(h, planBaseNavigation(current, lastBase, target), target);
      current = target;
      lastBase = target;
    };
    const toFlow = (name: string): void => {
      h.entries.push(name);
      current = name;
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
