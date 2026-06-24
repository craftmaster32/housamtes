import { useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Text } from 'react-native-paper';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useMorePopupStore } from '@stores/morePopupStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useBadgeStore, countNew, countNewSimple } from '@stores/badgeStore';
import { useBillsStore } from '@stores/billsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useVotingStore } from '@stores/votingStore';
import { useAuthStore } from '@stores/authStore';
import { useColors } from '@hooks/useColors';
import { sizes } from '@constants/sizes';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItem {
  id: string;
  icon: IoniconName;
  iconActive: IoniconName;
  label: string;
  route: string;
}

const TABS: TabItem[] = [
  {
    id: 'dashboard',
    icon: 'home-outline',
    iconActive: 'home',
    label: 'Home',
    route: '/(tabs)/dashboard',
  },
  { id: 'bills', icon: 'card-outline', iconActive: 'card', label: 'Bills', route: '/(tabs)/bills' },
  {
    id: 'parking',
    icon: 'car-outline',
    iconActive: 'car',
    label: 'Parking',
    route: '/(tabs)/parking',
  },
  { id: 'more', icon: 'grid-outline', iconActive: 'grid', label: 'More', route: '' },
];

interface AnimatedIconProps {
  active: boolean;
  name: IoniconName;
  size: number;
  color: string;
}

function AnimatedIcon({ active, name, size, color }: AnimatedIconProps): React.JSX.Element {
  const scale = useSharedValue(active ? 1.15 : 1);

  useEffect(() => {
    scale.value = withSpring(active ? 1.15 : 1, { damping: 12, stiffness: 200 });
  }, [active, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}

export function BottomTabBar(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useColors();

  const tabLabels: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    bills: t('nav.bills'),
    parking: t('nav.parking'),
    more: t('nav.more'),
  };
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isMoreOpen = useMorePopupStore((s) => s.isOpen);
  const openMore = useMorePopupStore((s) => s.open);
  const closeMore = useMorePopupStore((s) => s.close);
  const closeProfile = useProfilePopupStore((s) => s.close);

  const bills = useBillsStore((s) => s.bills);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const billBadge = countNewSimple(
    bills.filter((b) => !b.settled),
    lastSeen.bills
  );
  const reservations = useParkingStore((s) => s.reservations);
  const items = useGroceryStore((s) => s.items);
  const chores = useChoresStore((s) => s.chores);
  const proposals = useVotingStore((s) => s.proposals);
  const myId = useAuthStore((s) => s.profile?.id);
  const parkingBadge = myId
    ? reservations.filter(
        (r) =>
          r.status === 'pending' &&
          r.requestedBy !== myId &&
          !r.votes.some((v) => v.userId === myId)
      ).length
    : 0;
  const groceryBadge = myId
    ? countNew(
        items.filter((i) => !i.isDraft && !i.isChecked),
        lastSeen.grocery,
        myId,
        'addedBy'
      )
    : 0;
  const choresBadge = countNewSimple(
    chores.filter((c) => !c.isComplete),
    lastSeen.chores
  );
  const votingBadge = myId
    ? proposals.filter(
        (p) => p.isOpen && p.createdBy !== myId && !p.votes.some((v) => v.person === myId)
      ).length
    : 0;
  const moreBadge = groceryBadge + choresBadge + votingBadge;

  const isActive = useCallback(
    (id: string): boolean => {
      if (id === 'more') return isMoreOpen;
      return pathname.includes(`/${id}`);
    },
    [isMoreOpen, pathname]
  );

  const handleTab = useCallback(
    (tab: TabItem): void => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      closeMore();
      closeProfile();
      if (tab.id === 'more') {
        openMore();
      } else {
        router.navigate(tab.route as Parameters<typeof router.navigate>[0]);
      }
    },
    [openMore, closeMore, closeProfile]
  );

  const handleAdd = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    closeMore();
    closeProfile();
    router.push('/(tabs)/bills/add');
  }, [closeMore, closeProfile]);

  const bg = c.background;
  const borderColor = c.border;
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg, borderTopColor: borderColor, paddingBottom: bottomInset },
      ]}
      testID="bottom-tab-bar"
    >
      {/* Left two tabs */}
      {TABS.slice(0, 2).map((tab) => {
        const active = isActive(tab.id);
        const badge = tab.id === 'bills' ? billBadge : 0;
        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTab(tab)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={tabLabels[tab.id]}
            accessibilityState={{ selected: active }}
          >
            <View style={styles.tabIconWrap}>
              <AnimatedIcon
                active={active}
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? c.primary : c.textSecondary}
              />
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: c.danger, borderColor: bg }]}>
                  <Text style={[styles.badgeText, { color: c.white }]}>
                    {badge > 9 ? '9+' : String(badge)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.label,
                { color: active ? c.primary : c.textSecondary },
                active && styles.labelActive,
              ]}
            >
              {tabLabels[tab.id]}
            </Text>
            {active && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.activeDot, { backgroundColor: c.primary }]}
              />
            )}
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
        const badge = tab.id === 'parking' ? parkingBadge : tab.id === 'more' ? moreBadge : 0;
        return (
          <Pressable
            key={tab.id}
            style={styles.tab}
            onPress={() => handleTab(tab)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={tabLabels[tab.id]}
            accessibilityState={{ selected: active }}
          >
            <View style={styles.tabIconWrap}>
              <AnimatedIcon
                active={active}
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? c.primary : c.textSecondary}
              />
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: c.danger, borderColor: bg }]}>
                  <Text style={[styles.badgeText, { color: c.white }]}>
                    {badge > 9 ? '9+' : String(badge)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.label,
                { color: active ? c.primary : c.textSecondary },
                active && styles.labelActive,
              ]}
            >
              {tabLabels[tab.id]}
            </Text>
            {active && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.activeDot, { backgroundColor: c.primary }]}
              />
            )}
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
    minHeight: sizes.bottomTabBarHeight,
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
  activeDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

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
