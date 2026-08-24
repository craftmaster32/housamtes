import { useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { collapseHistoryForBase } from '@stores/navigationStore';

// Rendered as the Tabs navigator's `tabBar` (see app/(tabs)/_layout.tsx). It
// draws nothing — the real tab bar is the custom BottomTabBar in the root
// layout — but living inside the navigator gives it the tab navigator's live
// `state` and `navigation`. Whenever a base (main section) tab becomes focused,
// it resets the tab history to [home, base] so that back — from any back
// mechanism — returns home. Flow tabs are left untouched.
export function TabHistoryBridge({ state, navigation }: BottomTabBarProps): null {
  useEffect(() => {
    const nextHistory = collapseHistoryForBase(state.routes, state.index, state.history);
    if (!nextHistory) return;
    navigation.dispatch({
      ...CommonActions.reset({ ...state, history: nextHistory }),
      target: state.key,
    });
  }, [state, navigation]);

  return null;
}
