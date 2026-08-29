import { Platform } from 'react-native';
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

// The section a flow page belongs to. Settings sub-pages live at 'settings/*'
// but hang off the Settings hub at 'more/settings'; every other flow hangs off
// its own feature index ('bills/[id]' and 'bills/add' → 'bills/index').
export function sectionOfTab(routeName: string): string {
  if (routeName.startsWith('settings/')) return 'more/settings';
  return `${routeName.split('/')[0]}/index`;
}

// The tab route name a base href points at: '/(tabs)/bills' and
// '/(tabs)/bills/index' → 'bills/index', '/(tabs)/more/settings' → itself.
export function hrefToTabName(href: string): string {
  const path = href
    .replace(/^\/\(tabs\)\/?/, '')
    .split('?')[0]
    .replace(/\/$/, '');
  if (!path) return HOME_TAB_NAME;
  if (path === 'more/settings' || path.endsWith('/index')) return path;
  return `${path}/index`;
}

// The currently focused tab, kept current by TabHistoryBridge. Lets
// navigateToBase decide push (from home) vs replace (from another section) so the
// browser history never accumulates on web.
let currentTabName: string | null = null;
// The last BASE tab that was focused — i.e. the section a flow page was opened
// from, so the entry sitting directly under the current flow in the browser
// history. planBaseNavigation uses it to know what a single pop would land on.
let lastBaseTabName: string | null = null;

export function setCurrentTab(name: string): void {
  currentTabName = name;
  if (isBaseTab(name)) lastBaseTabName = name;
}

// Test seam: reset the module-level tracking between cases.
export function resetTabTracking(): void {
  currentTabName = null;
  lastBaseTabName = null;
}

// Treat an unknown current tab as "home" so the very first navigation pushes
// (keeping home underneath) rather than replacing it away.
export function isOnHome(): boolean {
  return currentTabName === null || currentTabName === HOME_TAB_NAME;
}

export type BaseNavPlan = 'push' | 'replace' | 'pop' | 'pop-replace';

// How to reach a base section while keeping the web history at exactly
// [home] | [home, section] | [home, section, flow].
//
// The bug this exists to prevent: from a FLOW page, a plain replace swaps only
// the top entry, so the section the flow was opened from stays in history. Doing
// section → flow → section repeatedly then leaves one stale section entry per
// round, and back has to walk every one of them before reaching Home. Popping
// the flow instead lands directly on the section that is already underneath.
export function planBaseNavigation(
  currentTab: string | null,
  lastBaseTab: string | null,
  targetTab: string
): BaseNavPlan {
  // From Home: push, so Home stays underneath.
  if (currentTab === null || currentTab === HOME_TAB_NAME) return 'push';
  // From another section: swap it — sections never stack on each other.
  if (isBaseTab(currentTab)) return 'replace';
  // From a flow: one pop lands on the section it was opened from. That is the
  // target already when returning to its own section; otherwise pop first, then
  // swap that section for the one we actually want.
  return lastBaseTab === targetTab ? 'pop' : 'pop-replace';
}

// Pop the current flow, then swap the section underneath for the target. The
// replace has to wait for the pop to land — browser history moves are async — so
// it is driven off the popstate the pop emits rather than fired in the same tick.
function popThenReplace(target: Parameters<typeof router.replace>[0]): void {
  if (typeof window === 'undefined' || !router.canGoBack()) {
    router.replace(target);
    return;
  }
  const onPop = (): void => {
    window.removeEventListener('popstate', onPop);
    router.replace(target);
  };
  window.addEventListener('popstate', onPop);
  router.back();
}

// Navigate to a base (main section), keeping the web history flat.
//
// Native needs none of this: TabHistoryBridge resets the tab navigator's own
// history to [home, section] whenever a section is focused, so push/replace is
// enough there. Only the browser keeps the entries we have to avoid creating.
export function navigateToBase(href: string): void {
  const target = href as Parameters<typeof router.replace>[0];
  if (Platform.OS !== 'web') {
    if (isOnHome()) router.push(target);
    else router.replace(target);
    return;
  }

  const plan = planBaseNavigation(currentTabName, lastBaseTabName, hrefToTabName(href));
  // A flow opened directly (deep link / refreshed URL) has nothing underneath to
  // pop to, so fall back to replacing in place.
  if ((plan === 'pop' || plan === 'pop-replace') && !router.canGoBack()) {
    router.replace(target);
    return;
  }
  switch (plan) {
    case 'push':
      router.push(target);
      break;
    case 'pop':
      router.back();
      break;
    case 'pop-replace':
      popThenReplace(target);
      break;
    default:
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
