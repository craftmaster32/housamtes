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
  params?: { from?: string } | object;
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
  // Settings opened from Profile is a page of Profile, not a section, so its
  // pushed history is left alone the same way any other flow's is.
  if (!focused || !isBaseRoute(focused.name, focused.params as { from?: string })) return null;
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

// Settings is the one screen that is a section or a sub-page depending on how it
// was opened: from the home avatar menu / More list it is a main section (back →
// Home), but from Profile it is a page of Profile (back → Profile). The `from`
// param carries that intent, so "is this a section?" needs the params, not just
// the route name.
export const SETTINGS_TAB_NAME = 'more/settings';

export function isBaseRoute(name: string, params?: { from?: string } | null): boolean {
  if (name === SETTINGS_TAB_NAME) return params?.from !== 'profile';
  return isBaseTab(name);
}

// The tab names currently stacked in the browser history, home first. Kept in
// step with real navigation by setCurrentTab: a tab already in the stack means
// we went back to it (truncate), a new one means we went forward (append).
// Knowing the actual stack — rather than guessing what sits underneath — is what
// lets a base navigation unwind an arbitrarily deep flow chain in one move.
let tabStack: string[] = [HOME_TAB_NAME];
let currentTabName: string | null = null;
let currentIsBase = true;

export function setCurrentTab(name: string, params?: { from?: string } | null): void {
  currentTabName = name;
  currentIsBase = isBaseRoute(name, params);
  const seenAt = tabStack.indexOf(name);
  tabStack = seenAt >= 0 ? tabStack.slice(0, seenAt + 1) : [...tabStack, name];
}

export function getTabStack(): readonly string[] {
  return tabStack;
}

// Test seam: reset the module-level tracking between cases.
export function resetTabTracking(): void {
  tabStack = [HOME_TAB_NAME];
  currentTabName = null;
  currentIsBase = true;
}

// Treat an unknown current tab as "home" so the very first navigation pushes
// (keeping home underneath) rather than replacing it away.
export function isOnHome(): boolean {
  return currentTabName === null || currentTabName === HOME_TAB_NAME;
}

// How many entries to drop, and whether to then swap the one we land on, to
// reach a section while keeping the history at [home, section] — or, for
// Settings opened from Profile, [home, profile, settings].
export interface BaseNavAction {
  pops: number;
  replace: boolean;
}

// The bug this prevents: from a FLOW page a plain replace swaps only the top
// entry, leaving the section the flow was opened from in history. Repeating
// section → flow → section then strands one section entry per round and back has
// to walk them all. Unwinding to the target instead keeps history flat, however
// deep the flow chain got.
export function planBaseNavigation(
  stack: readonly string[],
  isBase: boolean,
  targetTab: string
): BaseNavAction {
  // On Home: push, so Home stays underneath.
  if (stack.length <= 1) return { pops: 0, replace: false };
  // On another section: swap it — sections never stack on each other.
  if (isBase) return { pops: 0, replace: true };
  // On a flow: if the target is already somewhere below us, unwind straight to
  // it. Otherwise unwind to the section this chain hangs off and swap that.
  const seenAt = stack.indexOf(targetTab);
  if (seenAt >= 0) return { pops: stack.length - 1 - seenAt, replace: false };
  return { pops: stack.length - 2, replace: true };
}

// Drop `pops` history entries, then optionally swap what we land on for the
// target. Browser history moves are async, so the replace is driven off the
// popstate the pop emits rather than fired in the same tick.
function unwind(pops: number, replaceWith: string | null): void {
  const target = replaceWith as Parameters<typeof router.replace>[0];
  const finish = (): void => {
    if (replaceWith === null) return;
    router.replace(target);
    tabStack = [HOME_TAB_NAME, replaceWith];
  };
  if (pops <= 0) {
    finish();
    return;
  }
  const onPop = (): void => {
    window.removeEventListener('popstate', onPop);
    finish();
  };
  window.addEventListener('popstate', onPop);
  window.history.go(-pops);
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

  const targetTab = hrefToTabName(href);
  const { pops, replace } = planBaseNavigation(tabStack, currentIsBase, targetTab);

  // A flow opened directly (deep link / refreshed URL) has nothing underneath to
  // unwind into, so fall back to replacing in place.
  if (pops > 0 && (typeof window === 'undefined' || !router.canGoBack())) {
    router.replace(target);
    tabStack = [HOME_TAB_NAME, targetTab];
    return;
  }

  if (pops === 0 && !replace) {
    router.push(target);
    tabStack = [HOME_TAB_NAME, targetTab];
    return;
  }
  if (pops === 0) {
    router.replace(target);
    tabStack = [HOME_TAB_NAME, targetTab];
    return;
  }
  unwind(pops, replace ? targetTab : null);
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
