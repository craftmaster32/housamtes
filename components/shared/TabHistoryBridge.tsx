import { useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { setCurrentTab, collapseHistoryForBase } from '@stores/navigationStore';

interface Props {
  state: BottomTabBarProps['state'];
  navigation: BottomTabBarProps['navigation'];
}

// Rendered as the Tabs navigator's `tabBar` (see app/(tabs)/_layout.tsx). It
// draws nothing — the real tab bar is the custom BottomTabBar in the root
// layout — but living inside the navigator gives it the tab navigator's live
// state and navigation. It does two things whenever the focused tab changes:
//  1. reports the focused tab to navigationStore (drives push-vs-replace on web);
//  2. on native, resets the tab history to [home, section] when a section is
//     focused, so back returns home regardless of how it was reached (flow pages
//     are left untouched).
export function TabHistoryBridge({ state, navigation }: Props): null {
  const focusedName = state.routes[state.index]?.name;

  useEffect((): void => {
    if (focusedName) setCurrentTab(focusedName);
  }, [focusedName]);

  useEffect((): void => {
    const nextHistory = collapseHistoryForBase(state.routes, state.index, state.history);
    if (!nextHistory) return;
    navigation.dispatch({
      ...CommonActions.reset({ ...state, history: nextHistory }),
      target: state.key,
    });
  }, [state, navigation]);

  return null;
}
