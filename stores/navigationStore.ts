import { router } from 'expo-router';

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
// TabHistoryBridge (rendered as the Tabs `tabBar`) watches the live tab state and
// applies this automatically: whenever a BASE tab becomes focused — however it
// was reached — it resets the tab history to [home, base]. Flow tabs are left
// alone, so their pushed history is preserved. Because this keys off the focused
// route rather than each call site, it covers every section without having to
// route every navigation through a helper.

export const HOME_ROUTE = '/(tabs)/dashboard';
// The home tab's route name inside the Tabs navigator.
export const HOME_TAB_NAME = 'dashboard/index';

type HistoryItem = { type: 'route'; key: string };
interface RouteLite {
  name: string;
  key: string;
}

// A tab is a "base" (main section) when it's a feature's index screen — every
// one is registered as '<feature>/index' — plus the Settings hub, which lives at
// 'more/settings'. Everything else (bills/add, settings/language, grocery/shop,
// profile/spending, bills/[id]…) is a flow that stacks on its base.
export function isBaseTab(routeName: string): boolean {
  return routeName.endsWith('/index') || routeName === 'more/settings';
}

// The back history a base page should leave behind: just [home] for home itself,
// otherwise [home, base] so back returns home.
export function computeBaseHistory(
  targetName: string,
  homeKey: string,
  baseKey: string
): HistoryItem[] {
  return targetName === HOME_TAB_NAME
    ? [{ type: 'route', key: homeKey }]
    : [
        { type: 'route', key: homeKey },
        { type: 'route', key: baseKey },
      ];
}

// Given the tab navigator's routes, focused index and current history, return the
// history it SHOULD have, or null when no change is needed. Returns null for flow
// pages (leave their pushed history) and when a base already sits on [home, base].
export function collapseHistoryForBase(
  routes: readonly RouteLite[],
  index: number,
  currentHistory: readonly { key: string }[] | undefined
): HistoryItem[] | null {
  const focused = routes[index];
  if (!focused || !isBaseTab(focused.name)) return null;
  const home = routes.find((r) => r.name === HOME_TAB_NAME);
  if (!home) return null;

  const desired = computeBaseHistory(focused.name, home.key, focused.key);
  const current = currentHistory ?? [];
  const unchanged =
    current.length === desired.length && current.every((h, i) => h.key === desired[i].key);
  return unchanged ? null : desired;
}

// Navigate to a base page. The bridge collapses history once it's focused, so a
// plain navigate is enough; this named helper just documents intent at the
// call site.
export function navigateToBase(href: string): void {
  router.navigate(href as Parameters<typeof router.navigate>[0]);
}

// One level back through the (now correct) navigation history. Used by screen
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
