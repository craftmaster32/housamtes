/**
 * QA — navigationStore
 *
 * The app is one hidden Tabs navigator; back walks the tab navigator's internal
 * `history`. To get the "base page" model we RESET that history to [home, base]
 * whenever we land on a base page, so back from any base returns home (and every
 * back mechanism — buttons, swipe, hardware, browser — follows suit).
 *
 * Covers:
 *  • toTabRouteName — href → Tabs route name mapping
 *  • computeBaseHistory — the [home] / [home, base] history a base leaves behind
 *  • resetToBase — dispatches a RESET to the Tabs navigator with that history
 *  • navigateToBase — falls back to a plain navigate when navigation isn't ready
 *  • goBack — one level back, collapsing to home at the root
 */

import {
  HOME_ROUTE,
  toTabRouteName,
  computeBaseHistory,
  resetToBase,
  navigateToBase,
  registerNavigationRef,
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

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: (state: unknown): { type: string; payload: unknown } => ({
      type: 'RESET',
      payload: state,
    }),
  },
}));

type Ref = Parameters<typeof registerNavigationRef>[0];

// A fake Tabs-inside-Stack navigation tree with three tabs.
function makeRef(ready = true): { ref: Ref; dispatch: jest.Mock } {
  const dispatch = jest.fn();
  const tabState = {
    type: 'tab',
    key: 'tab-1',
    index: 0,
    routeNames: ['dashboard/index', 'bills/index', 'calendar/index'],
    routes: [
      { name: 'dashboard/index', key: 'd' },
      { name: 'bills/index', key: 'b' },
      { name: 'calendar/index', key: 'c' },
    ],
    history: [{ type: 'route', key: 'd' }],
  };
  const root = {
    type: 'stack',
    key: 'stack-1',
    routes: [{ name: '(tabs)', key: 't', state: tabState }],
  };
  const ref = {
    isReady: (): boolean => ready,
    getRootState: (): unknown => root,
    dispatch,
  } as unknown as Ref;
  return { ref, dispatch };
}

describe('toTabRouteName', () => {
  it('maps single-segment hrefs to <name>/index', () => {
    expect(toTabRouteName('/(tabs)/bills')).toBe('bills/index');
    expect(toTabRouteName('/(tabs)/calendar')).toBe('calendar/index');
    expect(toTabRouteName('/(tabs)/dashboard')).toBe('dashboard/index');
  });
  it('keeps multi-segment leaf routes as-is', () => {
    expect(toTabRouteName('/(tabs)/more/settings')).toBe('more/settings');
    expect(toTabRouteName('/(tabs)/bills/index')).toBe('bills/index');
  });
});

describe('computeBaseHistory', () => {
  it('leaves just [home] for the home tab', () => {
    expect(computeBaseHistory('dashboard/index', 'd', 'd')).toEqual([{ type: 'route', key: 'd' }]);
  });
  it('leaves [home, base] for any other base', () => {
    expect(computeBaseHistory('calendar/index', 'd', 'c')).toEqual([
      { type: 'route', key: 'd' },
      { type: 'route', key: 'c' },
    ]);
  });
});

describe('resetToBase', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('dispatches a RESET to the Tabs navigator with [home, base] history', () => {
    const { ref, dispatch } = makeRef();
    registerNavigationRef(ref);

    const ok = resetToBase('calendar/index');
    expect(ok).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);

    const action = dispatch.mock.calls[0][0];
    expect(action.type).toBe('RESET');
    expect(action.target).toBe('tab-1');
    expect(action.payload.index).toBe(2); // calendar is routes[2]
    expect(action.payload.history).toEqual([
      { type: 'route', key: 'd' },
      { type: 'route', key: 'c' },
    ]);
  });

  it('returns false when navigation is not ready', () => {
    const { ref, dispatch } = makeRef(false);
    registerNavigationRef(ref);
    expect(resetToBase('bills/index')).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns false for an unknown base route', () => {
    const { ref, dispatch } = makeRef();
    registerNavigationRef(ref);
    expect(resetToBase('nope/index')).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('navigateToBase', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('resets history for a known base', () => {
    const { ref, dispatch } = makeRef();
    registerNavigationRef(ref);
    navigateToBase('/(tabs)/bills');
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].payload.index).toBe(1); // bills is routes[1]
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to a plain navigate when navigation is not ready', () => {
    const { ref } = makeRef(false);
    registerNavigationRef(ref);
    navigateToBase('/(tabs)/calendar');
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/calendar');
  });
});

describe('goBack', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockNavigate.mockClear();
  });

  it('goes back one level when possible', () => {
    mockCanGoBack.mockReturnValue(true);
    expect(goBack()).toBe(true);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('collapses to home when it cannot go back', () => {
    mockCanGoBack.mockReturnValue(false);
    registerNavigationRef(makeRef(false).ref); // not ready → navigateToBase falls back
    expect(goBack()).toBe(false);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(HOME_ROUTE);
  });
});
