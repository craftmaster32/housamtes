import { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, ScrollView, PanResponder, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useDrawerStore } from '@stores/drawerStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useChatStore } from '@stores/chatStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const DRAWER_WIDTH = 280;

interface NavItem {
  icon: string;
  labelKey: string;
  route: string;
  featureKey?: string;
}

const MAIN_NAV: NavItem[] = [
  { icon: '🏠', labelKey: 'nav.dashboard', route: '/(tabs)/dashboard' },
  { icon: '💰', labelKey: 'nav.bills', route: '/(tabs)/bills' },
  { icon: '🚗', labelKey: 'nav.parking', route: '/(tabs)/parking', featureKey: 'parking' },
  { icon: '🛒', labelKey: 'nav.grocery', route: '/(tabs)/grocery', featureKey: 'grocery' },
  { icon: '🧹', labelKey: 'nav.chores', route: '/(tabs)/chores', featureKey: 'chores' },
];

const MORE_NAV: NavItem[] = [
  { icon: '💬', labelKey: 'nav.chat', route: '/(tabs)/more/chat', featureKey: 'chat' },
  { icon: '📷', labelKey: 'nav.photos', route: '/(tabs)/photos' },
  { icon: '👥', labelKey: 'nav.housemates', route: '/(tabs)/bills/setup' },
  { icon: '🗳️', labelKey: 'nav.votes', route: '/(tabs)/voting', featureKey: 'voting' },
  { icon: '🔧', labelKey: 'nav.maintenance', route: '/(tabs)/maintenance', featureKey: 'maintenance' },
  { icon: '📋', labelKey: 'nav.condition', route: '/(tabs)/condition', featureKey: 'condition' },
];

const PROFILE_NAV: NavItem[] = [
  { icon: '📊', labelKey: 'nav.profile', route: '/(tabs)/profile' },
  { icon: '⚙️', labelKey: 'nav.settings', route: '/(tabs)/settings' },
];

export function DrawerMenu(): React.JSX.Element {
  const { t } = useTranslation();
  const isOpen = useDrawerStore((s) => s.isOpen);
  const close = useDrawerStore((s) => s.close);
  const open = useDrawerStore((s) => s.open);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const housemates = useHousematesStore((s) => s.housemates);
  const settingsFeatures = useSettingsStore((s) => s.features);
  const permissions = useAuthStore((s) => s.permissions);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const pathname = usePathname();

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

  const navigate = useCallback((route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
    router.push(route as Parameters<typeof router.push>[0]);
  }, [close]);

  const handleLogout = useCallback(async () => {
    close();
    await signOut();
    router.replace('/(auth)/welcome');
  }, [close, signOut]);

  const initial = (user?.name ?? '?')[0].toUpperCase();

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
            <View style={[styles.avatar, { backgroundColor: user?.avatarColor ?? colors.primary }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name ?? 'You'}</Text>
              <Text style={styles.profileSub}>
                {housemates.length > 0 ? t('common.person', { count: housemates.length }) : 'Nestiq'}
              </Text>
            </View>
            <Text style={styles.profileArrow}>›</Text>
          </Pressable>

          <View style={styles.divider} />

          {/* Main navigation */}
          {filterNav(MAIN_NAV).map((item) => (
            <Pressable
              key={item.route}
              style={[styles.navItem, isActive(item.route) && styles.navItemActive]}
              onPress={() => navigate(item.route)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive(item.route) && styles.navLabelActive]}>
                {t(item.labelKey)}
              </Text>
              {isActive(item.route) && <View style={[styles.activeIndicator, isRTLMode ? styles.activeIndicatorRTL : styles.activeIndicatorLTR]} />}
            </Pressable>
          ))}

          <View style={styles.divider} />

          {/* More section */}
          <Text style={styles.sectionLabel}>{t('nav.house_section')}</Text>
          {filterNav(MORE_NAV).map((item) => {
            const isChatItem = item.route === '/(tabs)/more/chat';
            const showBadge = isChatItem && unreadCount > 0;
            return (
              <Pressable
                key={item.route}
                style={[styles.navItem, isActive(item.route) && styles.navItemActive]}
                onPress={() => navigate(item.route)}
              >
                <Text style={styles.navIcon}>{item.icon}</Text>
                <Text style={[styles.navLabel, isActive(item.route) && styles.navLabelActive]}>
                  {t(item.labelKey)}
                </Text>
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
                {isActive(item.route) && <View style={[styles.activeIndicator, isRTLMode ? styles.activeIndicatorRTL : styles.activeIndicatorLTR]} />}
              </Pressable>
            );
          })}

          <View style={styles.divider} />

          {/* Profile & tools */}
          <Text style={styles.sectionLabel}>{t('nav.me_section')}</Text>
          {PROFILE_NAV.map((item) => (
            <Pressable
              key={item.route}
              style={[styles.navItem, isActive(item.route) && styles.navItemActive]}
              onPress={() => navigate(item.route)}
            >
              <Text style={styles.navIcon}>{item.icon}</Text>
              <Text style={[styles.navLabel, isActive(item.route) && styles.navLabelActive]}>
                {t(item.labelKey)}
              </Text>
              {isActive(item.route) && <View style={styles.activeIndicator} />}
            </Pressable>
          ))}

          <View style={styles.divider} />

          {/* Sign out */}
          <Pressable style={styles.navItem} onPress={handleLogout}>
            <Text style={styles.navIcon}>🚪</Text>
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
  },
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
  profileArrow: {
    color: colors.textSecondary,
    fontSize: sizes.fontLg,
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
  navIcon: { fontSize: 20, width: 28, textAlign: 'center' },
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
