import { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, ScrollView, PanResponder, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { router, usePathname, Link } from 'expo-router';
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
import { useColors } from '@hooks/useColors';
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
  badgeKey?: BadgeFeature;
}

const MAIN_NAV: NavItem[] = [
  { icon: 'home-outline', iconActive: 'home', labelKey: 'nav.dashboard', route: '/(tabs)/dashboard' },
  { icon: 'card-outline', iconActive: 'card', labelKey: 'nav.bills', route: '/(tabs)/bills', badgeKey: 'bills' },
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
  const c        = useColors();
  const { t }    = useTranslation();
  const isOpen   = useDrawerStore((s) => s.isOpen);
  const close    = useDrawerStore((s) => s.close);
  const open     = useDrawerStore((s) => s.open);
  const user     = useAuthStore((s) => s.user);
  const profile  = useAuthStore((s) => s.profile);
  const signOut  = useAuthStore((s) => s.signOut);
  const housemates     = useHousematesStore((s) => s.housemates);
  const houseName      = useHousematesStore((s) => s.houseName);
  const settingsFeatures = useSettingsStore((s) => s.features);
  const permissions    = useAuthStore((s) => s.permissions);
  const unreadCount    = useChatStore((s) => s.unreadCount);
  const pathname       = usePathname();

  const lastSeen          = useBadgeStore((s) => s.lastSeen);
  const markSeen          = useBadgeStore((s) => s.markSeen);
  const myId              = profile?.id ?? '';
  const parkingReservations = useParkingStore((s) => s.reservations);
  const groceryItems      = useGroceryStore((s) => s.items);
  const chores            = useChoresStore((s) => s.chores);
  const proposals         = useVotingStore((s) => s.proposals);
  const maintenanceItems  = useMaintenanceStore((s) => s.requests);
  const bills             = useBillsStore((s) => s.bills);

  type GenericItem = { createdAt: string; [k: string]: unknown };
  const badgeCounts: Record<string, number> = {
    parking:     parkingReservations.filter((r) => r.status === 'pending' && r.requestedBy !== profile?.id).length,
    grocery:     countNew(groceryItems.filter((i) => !i.isChecked) as unknown as GenericItem[], lastSeen.grocery, myId, 'addedBy'),
    chores:      countNewSimple(chores.filter((ch) => !ch.isComplete), lastSeen.chores),
    bills:       countNewSimple(bills.filter((b) => !b.settled), lastSeen.bills),
    voting:      countNew(proposals.filter((p) => p.isOpen) as unknown as GenericItem[], lastSeen.voting, myId, 'createdBy'),
    maintenance: countNewSimple(maintenanceItems.filter((m) => m.status === 'open'), lastSeen.maintenance),
  };

  const filterNav = useCallback(
    (items: NavItem[]): NavItem[] =>
      items.filter((item) => {
        if (!item.featureKey) return true;
        if (!(settingsFeatures.find((f) => f.key === item.featureKey)?.enabled ?? false)) return false;
        const key = item.featureKey as keyof typeof permissions;
        if (permissions && key in permissions && !permissions[key]) return false;
        return true;
      }),
    [settingsFeatures, permissions]
  );

  const language    = useLanguageStore((s) => s.language);
  const isRTLMode   = isRTL(language);
  const isRTLRef    = useRef(isRTLMode);
  isRTLRef.current  = isRTLMode;

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
    if (isOpen) {
      // Spring open — natural, physical feel
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    } else {
      // Faster timing close — snappy exit per exit-faster-than-enter rule
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [isRTLMode ? DRAWER_WIDTH : -DRAWER_WIDTH, 0],
    extrapolate: 'clamp',
  });

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
    extrapolate: 'clamp',
  });

  const isActive = useCallback((route: string): boolean => {
    const segment = route.replace('/(tabs)', '').replace('/index', '');
    return pathname.includes(segment) && segment !== '';
  }, [pathname]);

  const handleNav = useCallback((badgeFeature?: BadgeFeature) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
    if (badgeFeature) markSeen(badgeFeature).catch(() => {});
  }, [close, markSeen]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
      router.replace('/(auth)/welcome');
    } catch {
      Alert.alert('Sign out failed', 'Could not sign you out. Please try again.');
    } finally {
      close();
    }
  }, [close, signOut]);

  const initial = (profile?.name ?? user?.email ?? '?')[0].toUpperCase();

  return (
    <>
      {!isOpen && (
        <View style={[styles.edgeZone, isRTLMode ? styles.edgeZoneRTL : styles.edgeZoneLTR]} {...edgePan.panHandlers} />
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Close drawer"
            accessibilityState={{ expanded: true }}
          />
        </Animated.View>

        {/* Drawer panel */}
        <Animated.View style={[
          styles.drawer,
          isRTLMode ? styles.drawerRTL : styles.drawerLTR,
          { backgroundColor: c.surface, transform: [{ translateX }] },
        ]}>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Profile header */}
            <Link asChild href="/(tabs)/profile">
            <Pressable
              style={({ pressed }) => [
                styles.profileSection,
                { backgroundColor: c.primary + '18', borderBottomColor: c.primary + '25' },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={() => handleNav()}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={`${profile?.name ?? 'Profile'}, view profile`}
              accessibilityState={{ selected: false }}
            >
              <View style={[styles.avatar, { backgroundColor: profile?.avatarUrl ? 'transparent' : (profile?.avatarColor ?? c.primary) }]}>
                {profile?.avatarUrl
                  ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" accessibilityLabel={`${profile?.name ?? 'User'}'s avatar`} />
                  : <Text style={[styles.avatarText, { color: c.white }]}>{initial}</Text>
                }
              </View>
              <View style={styles.profileInfo}>
                <Text style={[styles.profileName, { color: c.textPrimary }]}>{profile?.name ?? user?.email ?? 'You'}</Text>
                <Text style={[styles.profileSub, { color: c.textSecondary }]}>
                  {houseName || (housemates.length > 0 ? t('common.person', { count: housemates.length }) : 'HouseMates')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
            </Pressable>
            </Link>

            <View style={[styles.divider, { backgroundColor: c.border }]} />

            {/* Main navigation */}
            {filterNav(MAIN_NAV).map((item) => {
              const active   = isActive(item.route);
              const badgeKey = item.badgeKey ?? item.featureKey;
              const count    = badgeKey ? (badgeCounts[badgeKey] ?? 0) : 0;
              return (
                <Link key={item.route} asChild href={item.route as Parameters<typeof router.push>[0]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.navItem,
                    active && { backgroundColor: c.primary + '14' },
                    pressed && !active && { backgroundColor: c.primary + '0A', transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => handleNav(item.badgeKey ?? item.featureKey as BadgeFeature | undefined)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.labelKey)}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={20}
                    color={active ? c.primary : c.textSecondary}
                    style={styles.navIconEl}
                  />
                  <Text style={[styles.navLabel, { color: active ? c.primary : c.textPrimary }, active && styles.navLabelActive]}>
                    {t(item.labelKey)}
                  </Text>
                  {count > 0 && !active && (
                    <View style={[styles.badge, { backgroundColor: c.danger }]}>
                      <Text style={[styles.badgeText, { color: c.white }]}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  )}
                  {active && <View style={[styles.activeIndicator, { backgroundColor: c.primary }, isRTLMode ? styles.activeIndicatorRTL : styles.activeIndicatorLTR]} />}
                </Pressable>
                </Link>
              );
            })}

            <View style={[styles.divider, { backgroundColor: c.border }]} />

            {/* More section */}
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>{t('nav.house_section')}</Text>
            {filterNav(MORE_NAV).map((item) => {
              const active     = isActive(item.route);
              const isChatItem = item.route === '/(tabs)/more/chat';
              const count      = isChatItem
                ? unreadCount
                : (item.featureKey ? (badgeCounts[item.featureKey] ?? 0) : 0);
              return (
                <Link key={item.route} asChild href={item.route as Parameters<typeof router.push>[0]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.navItem,
                    active && { backgroundColor: c.primary + '14' },
                    pressed && !active && { backgroundColor: c.primary + '0A', transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => handleNav(item.featureKey as BadgeFeature | undefined)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.labelKey)}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={20}
                    color={active ? c.primary : c.textSecondary}
                    style={styles.navIconEl}
                  />
                  <Text style={[styles.navLabel, { color: active ? c.primary : c.textPrimary }, active && styles.navLabelActive]}>
                    {t(item.labelKey)}
                  </Text>
                  {count > 0 && !active && (
                    <View style={[styles.badge, { backgroundColor: c.danger }]}>
                      <Text style={[styles.badgeText, { color: c.white }]}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  )}
                  {active && <View style={[styles.activeIndicator, { backgroundColor: c.primary }, isRTLMode ? styles.activeIndicatorRTL : styles.activeIndicatorLTR]} />}
                </Pressable>
                </Link>
              );
            })}

            <View style={[styles.divider, { backgroundColor: c.border }]} />

            {/* Sign out */}
            <Pressable
              style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.65 }]}
              onPress={handleLogout}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('profile.sign_out')}
              accessibilityState={{ selected: false }}
            >
              <Ionicons name="log-out-outline" size={20} color={c.negative} style={styles.navIconEl} />
              <Text style={[styles.navLabel, { color: c.negative }]}>{t('profile.sign_out')}</Text>
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
  edgeZoneRTL:  { right: 0 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
  },
  drawerLTR: {
    left: 0,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerRTL: {
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 20,
  },
  scroll: { flex: 1 },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.md,
    padding: sizes.lg,
    paddingTop: sizes.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg:   { width: 52, height: 52 },
  avatarText:  { fontSize: 20, ...font.bold },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, ...font.bold },
  profileSub:  { fontSize: 13, ...font.medium, marginTop: 2 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: sizes.xs,
  },
  sectionLabel: {
    fontSize: 11,
    ...font.semibold,
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
  navIconEl: { width: 28, textAlign: 'center' },
  navLabel: {
    fontSize: 15,
    ...font.medium,
    flex: 1,
  },
  navLabelActive: { ...font.semibold },
  activeIndicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  activeIndicatorLTR: { left: 0 },
  activeIndicatorRTL: { right: 0 },
  badge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, ...font.bold },
});
