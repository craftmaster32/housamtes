import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMorePopupStore } from '@stores/morePopupStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useBadgeStore, countNewSimple } from '@stores/badgeStore';
import { useBillsStore } from '@stores/billsStore';
import { useColors } from '@hooks/useColors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItem {
  id: string;
  icon: IoniconName;
  iconActive: IoniconName;
  label: string;
  route: string;
}

const TABS: TabItem[] = [
  { id: 'dashboard', icon: 'home-outline',     iconActive: 'home',     label: 'Home',    route: '/(tabs)/dashboard' },
  { id: 'bills',     icon: 'card-outline',      iconActive: 'card',     label: 'Bills',   route: '/(tabs)/bills' },
  { id: 'parking',   icon: 'car-outline',        iconActive: 'car',      label: 'Parking', route: '/(tabs)/parking' },
  { id: 'more',      icon: 'grid-outline',       iconActive: 'grid',     label: 'More',    route: '' },
];

export function BottomTabBar(): React.JSX.Element {
  const c        = useColors();
  const insets   = useSafeAreaInsets();
  const pathname = usePathname();
  const openMore     = useMorePopupStore((s) => s.open);
  const closeMore    = useMorePopupStore((s) => s.close);
  const closeProfile = useProfilePopupStore((s) => s.close);

  const bills     = useBillsStore((s) => s.bills);
  const lastSeen  = useBadgeStore((s) => s.lastSeen);
  const billBadge = countNewSimple(bills.filter((b) => !b.settled), lastSeen.bills);

  const isActive = useCallback((id: string): boolean => {
    if (id === 'more') return false;
    return pathname.includes(`/${id}`);
  }, [pathname]);

  const handleTab = useCallback((tab: TabItem): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    closeMore();
    closeProfile();
    if (tab.id === 'more') {
      openMore();
    } else {
      router.navigate(tab.route as Parameters<typeof router.navigate>[0]);
    }
  }, [openMore, closeMore, closeProfile]);

  const handleAdd = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    closeMore();
    closeProfile();
    router.push('/(tabs)/bills/add');
  }, [closeMore, closeProfile]);

  const bg          = c.background;
  const borderColor = c.border;

  return (
    <View style={[
      styles.container,
      { backgroundColor: bg, borderTopColor: borderColor, paddingBottom: insets.bottom || 12 },
    ]}>
      {/* Left two tabs */}
      {TABS.slice(0, 2).map((tab) => {
        const active = isActive(tab.id);
        const badge  = tab.id === 'bills' ? billBadge : 0;
        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTab(tab)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <View style={styles.tabIconWrap}>
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? c.primary : c.textSecondary}
              />
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: c.danger, borderColor: bg }]}>
                  <Text style={[styles.badgeText, { color: c.white }]}>{badge > 9 ? '9+' : String(badge)}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: active ? c.primary : c.textSecondary }, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}

      {/* Center + button */}
      <View style={styles.centerWrap}>
        <Pressable
          style={[styles.addBtn, { backgroundColor: c.surface }]}
          onPress={handleAdd}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Add new expense"
          accessibilityState={{ disabled: false }}
        >
          <Ionicons name="add" size={28} color={c.primary} />
        </Pressable>
      </View>

      {/* Right two tabs */}
      {TABS.slice(2).map((tab) => {
        const active = isActive(tab.id);
        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTab(tab)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={active ? tab.iconActive : tab.icon}
              size={22}
              color={active ? c.primary : c.textSecondary}
            />
            <Text style={[styles.label, { color: active ? c.primary : c.textSecondary }, active && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  tabIconWrap: { position: 'relative', alignItems: 'center' },
  label: { fontSize: 11, letterSpacing: 0.2 },
  labelActive: { fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: { fontSize: 9, fontWeight: '800' },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#4F78B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
