import { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, ScrollView, PanResponder, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useDrawerStore } from '@stores/drawerStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useChatStore } from '@stores/chatStore';
import { useLanguageStore } from '@stores/languageStore';
import { useBadgeStore, countNew, countNewSimple, type BadgeFeature } from '@stores/badgeStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useVotingStore } from '@stores/votingStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { useBillsStore } from '@stores/billsStore';
import { isRTL } from '@lib/i18n';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const DRAWER_WIDTH = 280;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface NavItem {
  icon: IoniconName;
  iconActive: IoniconName;
  labelKey: string;
  route: string;
  featureKey?: string;
}

const MAIN_NAV: NavItem[] = [
  { icon: 'home-outline', iconActive: 'home', labelKey: 'nav.dashboard', route: '/(tabs)/dashboard' },
  { icon: 'card-outline', iconActive: 'card', labelKey: 'nav.bills', route: '/(tabs)/bills' },
  { icon: 'car-outline', iconActive: 'car', labelKey: 'nav.parking', route: '/(tabs)/parking', featureKey: 'parking' },
  { icon: 'cart-outline', iconActive: 'cart', labelKey: 'nav.grocery', route: '/(tabs)/grocery', featureKey: 'grocery' },
  { icon: 'checkmark-done-outline', iconActive: 'checkmark-done', labelKey: 'nav.chores', route: '/(tabs)/chores', featureKey: 'chores' },
];

const MORE_NAV: NavItem[] = [
  { icon: 'calendar-outline', iconActive: 'calendar', labelKey: 'nav.calendar', route: '/(tabs)/calendar' },
  { icon: 'chatbubbles-outline', iconActive: 'chatbubbles', labelKey: 'nav.chat', route: '/(tabs)/more/chat', featureKey: 'chat' },
  { icon: 'images-outline', iconActive: 'images', labelKey: 'nav.photos', route: '/(tabs)/photos' },
  { icon: 'people-outline', iconActive: 'people', labelKey: 'nav.housemates', route: '/(tabs)/bills/setup' },
  { icon: 'hand-left-outline', iconActive: 'hand-left', labelKey: 'nav.votes', route: '/(tabs)/voting', featureKey: 'voting' },
  { icon: 'construct-outline', iconActive: 'construct', labelKey: 'nav.property', route: '/(tabs)/property', featureKey: 'maintenance' },
];


export function DrawerMenu(): React.JSX.Element {
  const { t } = useTranslation();
  const isOpen = useDrawerStore((s) => s.isOpen);
  const close = useDrawerStore((s) => s.close);
  const open = useDrawerStore((s) => s.open);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const housemates = useHousematesStore((s) => s.housemates);
  const houseName = useHousematesStore((s) => s.houseName);
  const settingsFeatures = useSettingsStore((s) => s.features);
  const permissions = useAuthStore((s) => s.permissions);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const pathname = usePathname();

  // Badge counts from badge store
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const markSeen = useBadgeStore((s) => s.markSeen);
  const myId = profile?.id ?? '';
  const parkingReservations = useParkingStore((s) => s.reservations);
  const groceryItems = useGroceryStore((s) => s.items);
  const chores = useChoresStore((s) => s.chores);
  const proposals = useVotingStore((s) => s.proposals);
  const maintenanceItems = useMaintenanceStore((s) => s.requests);
  const bills = useBillsStore((s) => s.bills);

  type GenericItem = { createdAt: string; [k: string]: unknown };
  const badgeCounts: Record<string, number> = {
    parking: parkingReservations.filter((r) => r.status === 'pending' && r.requestedBy !== profile?.id).length,
    grocery: countNew(groceryItems.filter((i) => !i.isChecked) as unknown as GenericItem[], lastSeen.grocery, myId, 'addedBy'),
    chores: countNewSimple(chores.filter((c) => !c.isComplete), lastSeen.chores),
    bills: countNewSimple(bills.filter((b) => !b.settled), lastSeen.bills),
    voting: countNew(proposals.filter((p) => p.isOpen) as unknown as GenericItem[], lastSeen.voting, myId, 'createdBy'),
    maintenance: countNewSimple(maintenanceItems.filter((m) => m.status === 'open'), lastSeen.maintenance),
  };

  const filterNav = useCallback(
    (items: NavItem[]): NavItem[] =>
      items.filter((item) => {
        if (!item.featureKey) return true;
        // House-level feature flag
        if (!(settingsFeatures.find((f) => f.key === item.featureKey)?.enabled ?? false)) return false;
        // Per-member permission
        const key = item.featureKey as keyof typeof permissions;
        if (permissions && key in permissions && !permissions[key]) return false;
        return true;
      }),
    [settingsFeatures, permissions]
  );

  // Reactive RTL — reads from store so it updates immediately when language changes
  const language = useLanguageStore((s) => s.language);
  const isRTLMode = isRTL(language);

  // Use a ref so the gesture callbacks always read the latest RTL value
  const isRTLRef = useRef(isRTLMode);
  isRTLRef.current = isRTLMode;

  // Edge swipe to open drawer — left edge in LTR, right edge in RTL
  const edgePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, { dx, dy }) => {
        const startX = evt.nativeEvent.pageX - dx;
        if (isRTLRef.current) {
          const screenWidth = Dimensions.get('window').width;
          return startX > screenWidth - 28 && dx < -12 && Math.abs(dx) > Math.abs(dy);
        }
        return startX < 28 && dx > 12 && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderRelease: (_, { dx }) => {
        const triggered = isRTLRef.current ? dx < -40 : dx > 40;
        if (triggered) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          open();
        }
      },
    })
  ).current;

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isOpen ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [isOpen, anim]);

  // Slide from right in RTL, left in LTR
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [isRTLMode ? DRAWER_WIDTH : -DRAWER_WIDTH, 0],
  });

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  const isActive = useCallback((route: string): boolean => {
    const segment = route.replace('/(tabs)', '').replace('/index', '');
    return pathname.includes(segment) && segment !== '';
  }, [pathname]);

  const navigate = useCallback((route: string, badgeFeature?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
    if (badgeFeature) markSeen(badgeFeature as BadgeFeature).catch(() => {});
    router.push(route as Parameters<typeof router.push>[0]);
  }, [close, markSeen]);

  const handleLogout = useCallback(async () => {
    close();
    await signOut();
    router.replace('/(auth)/welcome');
  }, [close, signOut]);

  const initial = (profile?.name ?? user?.email ?? '?')[0].toUpperCase();

  return (
    <>
      {/* Edge swipe zone — left in LTR, right in RTL */}
      {!isOpen && (
        <View style={[styles.edgeZone, isRTLMode ? styles.edgeZoneRTL : styles.edgeZoneLTR]} {...edgePan.panHandlers} />
      )}

    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Drawer panel — anchored right in RTL, left in LTR */}
      <Animated.View style={[styles.drawer, isRTLMode ? styles.drawerRTL : styles.drawerLTR, { transform: [{ translateX }] }]}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Profile header — tappable to go to profile */}
          <Pressable style={styles.profileSection} onPress={() => navigate('/(tabs)/profile')}>
            <View style={[styles.avatar, { backgroundColor: profile?.avatarUrl ? 'transparent' : (profile?.avatarColor ?? colors.primary) }]}>
              {profile?.avatarUrl
                ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                : <Text style={styles.avatarText}>{initial}</Text>
              }
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.name ?? user?.email ?? 'You'}</Text>
              <Text style={styles.profileSub}>
                {houseName || (housemates.length > 0 ? t('common.person', { count: housemates.length }) : 'HouseMates')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          <View style={styles.divider} />

          {/* Main navigation */}
          {filterNav(MAIN_NAV).map((item) => {
            const active = isActive(item.route);
            const count = item.featureKey ? (badgeCounts[item.featureKey] ?? 0) : 0;
            return (
              <Pressable
                key={item.route}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => navigate(item.route, item.featureKey)}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={20}
                  color={active ? colors.primary : colors.textSecondary}
                  style={styles.navIconEl}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {t(item.labelKey)}
                </Text>
                {count > 0 && !active && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
                {active && <View style={[styles.activeIndicator, isRTLMode ? styles.activeIndicatorRTL : styles.activeIndicatorLTR]} />}
              </Pressable>
            );
          })}

          <View style={styles.divider} />

          {/* More section */}
          <Text style={styles.sectionLabel}>{t('nav.house_section')}</Text>
          {filterNav(MORE_NAV).map((item) => {
            const active = isActive(item.route);
            const isChatItem = item.route === '/(tabs)/more/chat';
            const count = isChatItem
              ? unreadCount
              : (item.featureKey ? (badgeCounts[item.featureKey] ?? 0) : 0);
            return (
              <Pressable
                key={item.route}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => navigate(item.route, item.featureKey)}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={20}
                  color={active ? colors.primary : colors.textSecondary}
                  style={styles.navIconEl}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {t(item.labelKey)}
                </Text>
                {count > 0 && !active && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
                {active && <View style={[styles.activeIndicator, isRTLMode ? styles.activeIndicatorRTL : styles.activeIndicatorLTR]} />}
              </Pressable>
            );
          })}

          <View style={styles.divider} />

          {/* Sign out */}
          <Pressable style={styles.navItem} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.negative} style={styles.navIconEl} />
            <Text style={[styles.navLabel, styles.signOutText]}>{t('profile.sign_out')}</Text>
          </Pressable>

        </ScrollView>
      </Animated.View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  edgeZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 22,
    zIndex: 999,
  },
  edgeZoneLTR: { left: 0 },
  edgeZoneRTL: { right: 0 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.white,
  },
  drawerLTR: { left: 0, boxShadow: '4px 0 20px rgba(0,0,0,0.12)' } as never,
  drawerRTL: { right: 0, boxShadow: '-4px 0 20px rgba(0,0,0,0.12)' } as never,
  scroll: { flex: 1 },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.md,
    padding: sizes.lg,
    paddingTop: sizes.xl,
    backgroundColor: colors.primary + '12',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.primary + '30',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 52, height: 52 },
  avatarText: {
    color: colors.white,
    fontSize: 20,
    ...font.bold,
  },
  profileInfo: { flex: 1 },
  profileName: {
    color: colors.textPrimary,
    fontSize: 17,
    ...font.bold,
  },
  profileSub: {
    color: colors.textSecondary,
    fontSize: 13,
    ...font.medium,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: sizes.xs,
  },
  sectionLabel: {
    fontSize: 11,
    ...font.semibold,
    color: colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: sizes.lg,
    paddingVertical: sizes.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: sizes.sm,
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm + 2,
    gap: 12,
    position: 'relative',
    borderRadius: sizes.borderRadius,
    borderCurve: 'continuous',
    marginVertical: 1,
  } as never,
  navItemActive: { backgroundColor: colors.primary + '14' },
  navIconEl: { width: 28, textAlign: 'center' },
  navLabel: {
    fontSize: 15,
    ...font.medium,
    color: colors.textPrimary,
    flex: 1,
  },
  navLabelActive: {
    ...font.semibold,
    color: colors.primary,
  },
  activeIndicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  activeIndicatorLTR: { left: 0 },
  activeIndicatorRTL: { right: 0 },
  signOutText: {
    ...font.medium,
    color: colors.negative,
  },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    ...font.bold,
  },
});
