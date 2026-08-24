import { useEffect } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { setCurrentTab } from '@stores/navigationStore';

// Rendered as the Tabs navigator's `tabBar` (see app/(tabs)/_layout.tsx). It
// draws nothing — the real tab bar is the custom BottomTabBar in the root
// layout — but living inside the navigator lets it read the live focused tab and
// report it to navigationStore, which uses it to push (from home) vs replace
// (from another section) so sections never accumulate in history.
export function TabHistoryBridge({ state }: BottomTabBarProps): null {
  const focusedName = state.routes[state.index]?.name;
  useEffect(() => {
    if (focusedName) setCurrentTab(focusedName);
  }, [focusedName]);
  return null;
}
