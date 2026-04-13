import { Tabs } from 'expo-router';

// Tab bar is hidden — navigation is handled by the side DrawerMenu.
// All screens are registered here so Expo Router can resolve their routes.
export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' }, gestureEnabled: true }}>
      <Tabs.Screen name="dashboard/index" />
      <Tabs.Screen name="bills/index" />
      <Tabs.Screen name="bills/add" options={{ href: null }} />
      <Tabs.Screen name="bills/setup" options={{ href: null }} />
      <Tabs.Screen name="parking/index" />
      <Tabs.Screen name="grocery/index" />
      <Tabs.Screen name="chores/index" />
      <Tabs.Screen name="more/index" options={{ href: null }} />
      <Tabs.Screen name="more/chat" options={{ href: null }} />
      <Tabs.Screen name="more/settings" options={{ href: null }} />
      <Tabs.Screen name="photos/index" />
      <Tabs.Screen name="settings/notifications" options={{ href: null }} />
      <Tabs.Screen name="settings/privacy-policy" options={{ href: null }} />
      <Tabs.Screen name="settings/terms" options={{ href: null }} />
      <Tabs.Screen name="settings/categories" options={{ href: null }} />
      <Tabs.Screen name="settings/members" options={{ href: null }} />
      <Tabs.Screen name="bills/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile/index" />
      <Tabs.Screen name="calendar/index" />
      <Tabs.Screen name="maintenance/index" />
      <Tabs.Screen name="voting/index" />
      <Tabs.Screen name="condition/index" />
    </Tabs>
  );
}
