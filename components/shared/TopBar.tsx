import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useAuthStore } from '@stores/authStore';
import { useColors } from '@hooks/useColors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

// Routes where the TopBar is hidden (these screens manage their own headers)
const MAIN_TAB_ROUTES = [
  '/dashboard', '/bills', '/parking', '/grocery',
  '/chores', '/profile', '/calendar', '/voting', '/photos', '/property',
];

function isMainTabRoute(pathname: string): boolean {
  return MAIN_TAB_ROUTES.some((r) => pathname.endsWith(r) || pathname.includes(`${r}/index`));
}

interface TopBarProps {
  scrollY?: Animated.Value;
}

export function TopBar({ scrollY }: TopBarProps = {}): React.JSX.Element | null {
  const c        = useColors();
  const insets   = useSafeAreaInsets();
  const openProfile = useProfilePopupStore((s) => s.open);
  const profile     = useAuthStore((s) => s.profile);
  const pathname = usePathname();

  const handleBack = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (router.canGoBack()) router.back();
    else router.push('/(tabs)/dashboard');
  }, []);

  const handleProfilePress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    openProfile();
  }, [openProfile]);

  // Hide on main tab screens — each screen handles its own header
  if (isMainTabRoute(pathname)) return null;

  const initial = profile?.name ? profile.name[0].toUpperCase() : '?';

  // Collapse animation — opacity tied to scrollY when provided
  const opacity = scrollY
    ? scrollY.interpolate({ inputRange: [0, 60], outputRange: [1, 0], extrapolate: 'clamp' })
    : 1;

  const barStyle = [
    styles.bar,
    {
      paddingTop: insets.top + sizes.sm,
      backgroundColor: c.surface,
      borderBottomColor: c.border,
    },
    scrollY ? { opacity } : undefined,
  ];

  return (
    <Animated.View style={barStyle}>
      {/* Left: back button */}
      <Pressable
        style={styles.iconBtn}
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={c.primary} />
      </Pressable>

      <Text style={[styles.appName, { color: c.primary }]}>HouseMates</Text>

      {/* Right: avatar */}
      <Pressable
        style={styles.iconBtn}
        onPress={handleProfilePress}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
      >
        <View style={[styles.avatar, { backgroundColor: profile?.avatarUrl ? 'transparent' : (profile?.avatarColor ?? c.primary) }]}>
          {profile?.avatarUrl
            ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
            : <Text style={styles.avatarText}>{initial}</Text>
          }
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingHorizontal: sizes.md,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appName: {
    flex: 1,
    fontSize: 20,
    ...font.extrabold,
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  iconBtn: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 34, height: 34 },
  avatarText: { color: '#fff', fontSize: 14, ...font.bold },
});
