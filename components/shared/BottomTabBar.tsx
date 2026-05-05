import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Link, usePathname } from 'expo-router';
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
  const openMore    = useMorePopupStore((s) => s.open);
  const closeMore   = useMorePopupStore((s) => s.close);
  const closeProfile = useProfilePopupStore((s) => s.close);

  const bills    = useBillsStore((s) => s.bills);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const billBadge = countNewSimple(bills.filter((b) => !b.settled), lastSeen.bills);

  const isActive = useCallback((id: string): boolean => {
    if (id === 'more') return false;
    return pathname.includes(`/${id}`);
  }, [pathname]);

  const handleNavTabPress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    closeMore();
    closeProfile();
  }, [closeMore, closeProfile]);

  const handleMorePress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    closeProfile();
    openMore();
  }, [openMore, closeProfile]);

  const handleAddPress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    closeMore();
    closeProfile();
  }, [closeMore, closeProfile]);

  const bg = c.background;
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
          <Link key={tab.id} asChild href={tab.route as Parameters<typeof Link>[0]['href']}>
            <Pressable
              style={styles.tab}
              onPress={handleNavTabPress}
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
          </Link>
        );
      })}

      {/* Center + button */}
      <View style={styles.centerWrap}>
        <Link asChild href="/(tabs)/bills/add">
          <Pressable
            style={[styles.addBtn, { backgroundColor: c.surface }]}
            onPress={handleAddPress}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add new expense"
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="add" size={28} color={c.primary} />
          </Pressable>
        </Link>
      </View>

      {/* Right two tabs — Parking uses Link, More opens a popup */}
      {TABS.slice(2).map((tab) => {
        const active = isActive(tab.id);
        const inner = (
          <Pressable
            style={styles.tab}
            onPress={tab.id === 'more' ? handleMorePress : handleNavTabPress}
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
        return tab.id === 'more' ? (
          <React.Fragment key={tab.id}>{inner}</React.Fragment>
        ) : (
          <Link key={tab.id} asChild href={tab.route as Parameters<typeof Link>[0]['href']}>
            {inner}
          </Link>
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

  // Center + button
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
