import { router } from 'expo-router';

// The whole app is one hidden Tabs navigator (see app/(tabs)/_layout.tsx): every
// screen — bills, calendar, add-bill, a settings sub-page — is a tab, and each
// navigation appends to history. "Back" (an in-app arrow, the edge-swipe, the
// hardware button, or — on web — the browser's own back gesture) walks that
// history, so it used to retrace every section ever visited.
//
// The model we want:
//  • Base pages (bills, calendar, chores, settings…) are the main sections.
//    Back from any section returns Home.
//  • Flow pages (add / edit / detail / a settings sub-page) stack on their
//    section, so back steps through the flow to the section, then Home.
//
// We drive the REAL navigation history so every back control agrees (crucially
// the browser's own back on web, which ignores any in-app logic):
//  • Opening a section FROM HOME pushes it → history becomes [home, section].
//  • Opening a section from anywhere else replaces the current entry → history
//    stays [home, section]; sections never accumulate.
//  • Flow screens keep using router.push, so they stack on the section.
//
// On web push/replace map to the browser's pushState/replaceState; on native
// expo-router's tab router turns a replace into "focus + drop the previous
// entry", so both platforms end up with back → Home.

export const HOME_ROUTE = '/(tabs)/dashboard';
// The home tab's route name inside the Tabs navigator.
export const HOME_TAB_NAME = 'dashboard/index';

// The currently focused tab, kept current by TabHistoryBridge. Lets
// navigateToBase decide push (from home) vs replace (from another section)
// without accumulating history.
let currentTabName: string | null = null;

export function setCurrentTab(name: string): void {
  currentTabName = name;
}

// Treat an unknown current tab as "home" so the very first navigation pushes
// (keeping home underneath) rather than replacing it away.
export function isOnHome(): boolean {
  return currentTabName === null || currentTabName === HOME_TAB_NAME;
}

// Navigate to a base (main section) so back always returns home. See the module
// header for the push-from-home / replace-otherwise rule.
export function navigateToBase(href: string): void {
  const target = href as Parameters<typeof router.replace>[0];
  if (isOnHome()) {
    router.push(target);
  } else {
    router.replace(target);
  }
}

// One level back. Used by screen back buttons and the edge-swipe on native.
// Returns true if it moved; at the root it collapses to home instead.
export function goBack(): boolean {
  if (router.canGoBack()) {
    router.back();
    return true;
  }
  router.replace(HOME_ROUTE as Parameters<typeof router.replace>[0]);
  return false;
}
