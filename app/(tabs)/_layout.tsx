import { Tabs } from 'expo-router';
import { TabHistoryBridge } from '@components/shared/TabHistoryBridge';

// Tab bar is hidden — navigation is handled by the side DrawerMenu.
// All screens are registered here so Expo Router can resolve their routes.
export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      // The visible tab bar is the custom BottomTabBar in the root layout; here
      // we render TabHistoryBridge in the tabBar slot instead. It draws nothing
      // but lets navigationStore reset this navigator's history to [home, base]
      // when opening a main section (so back from any section returns home).
      tabBar={(props): React.JSX.Element => <TabHistoryBridge {...props} />}
      // Navigation is driven programmatically across many hidden "tabs", so the
      // default backBehavior ('firstRoute') sent every back action to the first
      // screen (dashboard) instead of the previous one. 'history' makes back
      // return to the last-visited screen — e.g. Settings → Language → back now
      // lands on Settings, not the home page.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
        // NOTE: do not set `animation` here. With the native tab bar hidden and
        // navigation driven programmatically (BottomTabBar → router.navigate),
        // bottom-tabs `animation: 'fade'` plays the crossfade but leaves the
        // previous screen mounted — tapping a tab looks like it switches yet
        // stays on the current screen (most visible on web). Hard-cut is correct.
      }}
    >
      <Tabs.Screen name="dashboard/index" />
      <Tabs.Screen name="bills/index" />
      <Tabs.Screen name="bills/add" options={{ href: null }} />
      <Tabs.Screen name="bills/setup" options={{ href: null }} />
      <Tabs.Screen name="parking/index" />
      <Tabs.Screen name="machines/index" />
      <Tabs.Screen name="grocery/index" />
      <Tabs.Screen name="grocery/shop" options={{ href: null }} />
      <Tabs.Screen name="grocery/quick-buy" options={{ href: null }} />
      <Tabs.Screen name="chores/index" />
      <Tabs.Screen name="more/index" options={{ href: null }} />
      <Tabs.Screen name="more/chat" options={{ href: null }} />
      <Tabs.Screen name="more/settings" options={{ href: null }} />
      <Tabs.Screen name="photos/index" />
      <Tabs.Screen name="settings/notifications" options={{ href: null }} />
      <Tabs.Screen name="settings/appearance" options={{ href: null }} />
      <Tabs.Screen name="settings/language" options={{ href: null }} />
      <Tabs.Screen name="settings/calendar" options={{ href: null }} />
      <Tabs.Screen name="settings/privacy-policy" options={{ href: null }} />
      <Tabs.Screen name="settings/terms" options={{ href: null }} />
      <Tabs.Screen name="settings/categories" options={{ href: null }} />
      <Tabs.Screen name="settings/members" options={{ href: null }} />
      <Tabs.Screen name="bills/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/index" />
      <Tabs.Screen name="profile/spending" options={{ href: null }} />
      <Tabs.Screen name="calendar/index" />
      <Tabs.Screen name="maintenance/index" options={{ href: null }} />
      <Tabs.Screen name="voting/index" />
      <Tabs.Screen name="tasks/index" />
      <Tabs.Screen name="notes/index" />
      <Tabs.Screen name="condition/index" options={{ href: null }} />
      <Tabs.Screen name="property/index" />
      <Tabs.Screen name="games/index" options={{ href: null }} />
    </Tabs>
  );
}
