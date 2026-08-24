import { router } from 'expo-router';
import { CommonActions } from '@react-navigation/native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';

// The whole app is one hidden Tabs navigator (see app/(tabs)/_layout.tsx): every
// screen — bills, calendar, add-bill, a settings sub-page — is a tab. The tab
// navigator's back (used by router.back(), the edge-swipe, Android hardware back
// and web browser back alike) walks its internal `history` array, which grows on
// every navigation. That's why "back" retraced every screen ever visited.
//
// The model we want:
//  • Base pages (bills, calendar, chores, settings…) are the main destinations.
//    Landing on one collapses history to [home, base] — the previous base and
//    its flow are dropped — so back from any base returns home.
//  • Flow pages (add / edit / detail / a settings sub-page) push on top of the
//    current base, so back returns to that base, then home.
//
// We achieve this by resetting the Tabs navigator's real `history` to
// [home, base] whenever we navigate to a base page (navigateToBase). Flow pages
// keep using a normal router.push, which appends to history as before. Because
// we fix the actual navigation history — not a shadow copy — every back
// mechanism (in-app buttons, swipe, hardware, browser) then behaves correctly.

export const HOME_ROUTE = '/(tabs)/dashboard';
// The home tab's route name inside the Tabs navigator.
const HOME_TAB_NAME = 'dashboard/index';

// A minimal view of a React Navigation state tree — enough to find the Tabs
// navigator and read its routes/keys without depending on the full generic types.
interface NavStateLike {
  type?: string;
  key?: string;
  index?: number;
  routeNames?: string[];
  routes: { name: string; key?: string; state?: NavStateLike }[];
  history?: { type: string; key: string }[];
  preloadedRouteKeys?: string[];
}

type HistoryItem = { type: string; key: string };

// Convert an app href ('/(tabs)/calendar', '/(tabs)/more/settings') into the
// Tabs route name registered in app/(tabs)/_layout.tsx ('calendar/index',
// 'more/settings'). Single-segment features live at '<name>/index'.
export function toTabRouteName(href: string): string {
  const rel = href.replace(/^\/?\(tabs\)\//, '').replace(/^\/+/, '');
  return rel.includes('/') ? rel : `${rel}/index`;
}

// The back history a base page should leave behind: just [home] for home itself,
// otherwise [home, base] so back returns home.
export function computeBaseHistory(
  baseName: string,
  homeKey: string,
  baseKey: string
): HistoryItem[] {
  return baseName === HOME_TAB_NAME
    ? [{ type: 'route', key: homeKey }]
    : [
        { type: 'route', key: homeKey },
        { type: 'route', key: baseKey },
      ];
}

let navRef: NavigationContainerRefWithCurrent<ReactNavigation.RootParamList> | null = null;

// Registered once from the root layout so the module can reach the live
// navigation state from non-component call sites (the tab bar, the More sheet…).
export function registerNavigationRef(
  ref: NavigationContainerRefWithCurrent<ReactNavigation.RootParamList>
): void {
  navRef = ref;
}

// Depth-first search for the Tabs navigator's state in the tree.
function findTabState(state: NavStateLike): NavStateLike | undefined {
  if (state.type === 'tab') return state;
  for (const route of state.routes) {
    if (route.state) {
      const found = findTabState(route.state);
      if (found) return found;
    }
  }
  return undefined;
}

// Reset the Tabs navigator's history to [home, base] and focus the base. Returns
// false if navigation isn't ready or the routes can't be found, so the caller can
// fall back to a plain navigate.
export function resetToBase(baseName: string): boolean {
  if (!navRef || !navRef.isReady()) return false;
  const root = navRef.getRootState() as unknown as NavStateLike | undefined;
  if (!root) return false;
  const tab = findTabState(root);
  if (!tab || !tab.key) return false;

  const baseIdx = tab.routes.findIndex((r) => r.name === baseName);
  const homeIdx = tab.routes.findIndex((r) => r.name === HOME_TAB_NAME);
  if (baseIdx === -1 || homeIdx === -1) return false;

  const homeKey = tab.routes[homeIdx].key;
  const baseKey = tab.routes[baseIdx].key;
  if (!homeKey || !baseKey) return false;

  const nextState = {
    ...tab,
    index: baseIdx,
    history: computeBaseHistory(baseName, homeKey, baseKey),
    stale: false,
  };
  navRef.dispatch({
    ...CommonActions.reset(nextState as unknown as Parameters<typeof CommonActions.reset>[0]),
    target: tab.key,
  });
  return true;
}

// Navigate to a base page: collapse history to [home, base]. Falls back to a
// plain navigate if the reset can't run (e.g. navigation not ready yet).
export function navigateToBase(href: string): void {
  if (!resetToBase(toTabRouteName(href))) {
    router.navigate(href as Parameters<typeof router.navigate>[0]);
  }
}

// One-level back through the (now correct) navigation history. Used by screen
// back buttons and the edge-swipe. Returns true if it moved; at the root it
// collapses to home instead.
export function goBack(): boolean {
  if (router.canGoBack()) {
    router.back();
    return true;
  }
  navigateToBase(HOME_ROUTE);
  return false;
}
