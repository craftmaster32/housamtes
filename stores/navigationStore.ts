import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { router } from 'expo-router';

// Home is the root of every back path. Pressing back from any base page lands
// here; pressing back from home does nothing (or exits on Android).
export const HOME_ROUTE = '/dashboard';

// "Base" pages are the main destinations a housemate switches between — from
// the bottom bar, the More sheet, the profile menu or a dashboard tile. Landing
// on a base page collapses the back stack to [home, base]: the base you came
// from and whatever flow you had open there are dropped, so back from a base
// always returns home (never to the previous base). Every route NOT listed here
// is treated as a "flow" screen (add / edit / detail / a settings sub-page) that
// stacks on top of the current base and, on back, returns to it.
//
// Paths are compared without the (tabs) group segment, which Expo Router's
// usePathname() already omits.
const BASE_ROUTES: readonly string[] = [
  HOME_ROUTE,
  '/bills',
  '/parking',
  '/grocery',
  '/chores',
  '/calendar',
  '/photos',
  '/tasks',
  '/notes',
  '/voting',
  '/property',
  '/profile',
  '/games',
  '/maintenance',
  '/condition',
  '/more',
  // Two settings hubs exist in the app; both are top-level destinations whose
  // sub-pages (/settings/language, /settings/appearance…) are flows on top.
  '/settings',
  '/more/settings',
];

// Drop any query string and trailing slash so paths compare cleanly, and make
// the empty root resolve to home.
export function normalizePath(path: string): string {
  const noQuery = path.split('?')[0];
  const trimmed = noQuery.length > 1 ? noQuery.replace(/\/+$/, '') : noQuery;
  return trimmed === '' || trimmed === '/' ? HOME_ROUTE : trimmed;
}

export function isBaseRoute(path: string): boolean {
  return BASE_ROUTES.includes(normalizePath(path));
}

// A base page resets the stack: home alone if it *is* home, otherwise [home, base].
function baseReset(path: string): string[] {
  return path === HOME_ROUTE ? [HOME_ROUTE] : [HOME_ROUTE, path];
}

// Pure reducer: given the current back stack and the path just navigated to,
// return the next back stack.
//
//  • same as the top       → unchanged (re-navigation / params-only change)
//  • already in the stack  → truncate back to it (we returned to an ancestor,
//                            e.g. tapping the active tab or a native back)
//  • a new base page       → reset to [home] / [home, base]
//  • a new flow page       → push on top of the current base's flow
export function reduceStack(stack: string[], rawPath: string): string[] {
  const path = normalizePath(rawPath);
  if (stack.length === 0) return baseReset(path);

  const top = stack[stack.length - 1];
  if (path === top) return stack;

  const existing = stack.lastIndexOf(path);
  if (existing !== -1) return stack.slice(0, existing + 1);

  if (isBaseRoute(path)) return baseReset(path);
  return [...stack, path];
}

// The route a back press should land on, or null when already at the root.
export function backTarget(stack: string[]): string | null {
  return stack.length > 1 ? stack[stack.length - 2] : null;
}

// The stack after popping one level (never past the root).
export function stackAfterBack(stack: string[]): string[] {
  return stack.length > 1 ? stack.slice(0, stack.length - 1) : stack;
}

interface NavigationStore {
  // Logical back stack: stack[0] is always home, the last entry is the current
  // screen. Flow screens stack on top of their base; switching base collapses.
  stack: string[];
  // Reconcile the stack with the screen we just landed on. Call on every tabs
  // pathname change.
  sync: (path: string) => void;
  // Navigate one step back through the logical stack. Returns true if it moved,
  // false when already home (so callers can exit / do nothing).
  goBack: () => boolean;
  // Forget the stack (e.g. on sign-out) so the next entry starts fresh at home.
  reset: () => void;
}

export const useNavigationStore = create<NavigationStore>()(
  devtools(
    (set, get) => ({
      stack: [HOME_ROUTE],
      sync: (path): void => set((s) => ({ stack: reduceStack(s.stack, path) })),
      goBack: (): boolean => {
        const target = backTarget(get().stack);
        if (target === null) return false;
        set((s) => ({ stack: stackAfterBack(s.stack) }));
        // Stack entries are group-less pathnames (from usePathname). Navigate
        // with the (tabs)-qualified href the rest of the app uses so the route
        // always resolves.
        const href = `/(tabs)${target}` as Parameters<typeof router.navigate>[0];
        router.navigate(href);
        return true;
      },
      reset: (): void => set({ stack: [HOME_ROUTE] }),
    }),
    { name: 'navigation-store' }
  )
);

// Convenience for call sites that only need the back action (screen headers,
// the swipe gesture, the hardware back button). Returns true if it navigated.
export function goBack(): boolean {
  return useNavigationStore.getState().goBack();
}
