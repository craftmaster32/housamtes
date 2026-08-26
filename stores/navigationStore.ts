import { router } from 'expo-router';

// The whole app is one hidden Tabs navigator (see app/(tabs)/_layout.tsx): every
// screen — bills, calendar, add-bill, a settings sub-page — is a tab, and each
// navigation appends to the tab navigator's internal history. "Back" (an in-app
// arrow, the edge-swipe, the hardware button, or — on web — the browser's own
// back gesture) walks that history, so it used to retrace every section visited.
//
// The model we want:
//  • Base pages (bills, calendar, chores, settings…) are the main sections.
//    Back from any section returns Home.
//  • Flow pages (add / edit / detail / a settings sub-page) stack on their
//    section, so back steps through the flow to the section, then Home.
//
// Two platforms, two histories, so we fix both:
//  • WEB back uses the browser's history. navigateToBase pushes from Home (so
//    Home stays underneath) and replaces from anywhere else, so the browser
//    history stays [home, section] — sections never accumulate.
//  • NATIVE back uses the Tabs navigator's own `history` array. expo-router's
//    tab replace slices that history by route index, which is unreliable, so
//    TabHistoryBridge instead resets it explicitly to [home, section] whenever a
//    section becomes focused (collapseHistoryForBase). Flow pages are left
//    alone, so their pushed history is preserved.

export const HOME_ROUTE = '/(tabs)/dashboard';
// The home tab's route name inside the Tabs navigator.
export const HOME_TAB_NAME = 'dashboard/index';

interface HistoryItem {
  type: 'route';
  key: string;
}
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
// history it SHOULD have on native, or null when no change is needed. Returns
// null for flow pages (leave their pushed history) and when a base already sits
// on [home, base].
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

// The currently focused tab, kept current by TabHistoryBridge. Lets
// navigateToBase decide push (from home) vs replace (from another section) so the
// browser history never accumulates on web.
let currentTabName: string | null = null;

export function setCurrentTab(name: string): void {
  currentTabName = name;
}

// Treat an unknown current tab as "home" so the very first navigation pushes
// (keeping home underneath) rather than replacing it away.
export function isOnHome(): boolean {
  return currentTabName === null || currentTabName === HOME_TAB_NAME;
}

// Navigate to a base (main section). Pushes from Home (keeping Home underneath),
// replaces otherwise, so the browser history stays [home, section] on web. The
// bridge fixes the native tab history separately.
export function navigateToBase(href: string): void {
  const target = href as Parameters<typeof router.replace>[0];
  if (isOnHome()) {
    router.push(target);
  } else {
    router.replace(target);
  }
}

// One level back. Used by screen back buttons and the edge-swipe. Returns true if
// it moved; at the root it collapses to home instead. Keep this a real history
// pop (router.back) so the browser's smooth back-swipe animation is preserved.
export function goBack(): boolean {
  if (router.canGoBack()) {
    router.back();
    return true;
  }
  router.replace(HOME_ROUTE as Parameters<typeof router.replace>[0]);
  return false;
}
