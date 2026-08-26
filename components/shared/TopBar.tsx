import { useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { goBack } from '@stores/navigationStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useAuthStore } from '@stores/authStore';
import { useColors } from '@hooks/useColors';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

import { mf, ms } from '@utils/responsive';
// The redesign gave almost every screen its own header + back button, so the
// shared TopBar is now only needed on the handful of legacy screens that still
// lack one. Showing it anywhere else produced a duplicate ("two back buttons").
// Keep this list in sync as those screens get their own headers.
const LEGACY_TOPBAR_ROUTES = [
  '/bills/setup',
  '/tasks',
  '/notes',
  '/condition',
  '/maintenance',
  '/settings/members',
  '/settings/categories',
];

function needsTopBar(pathname: string): boolean {
  return LEGACY_TOPBAR_ROUTES.some((r) => pathname.endsWith(r) || pathname.includes(`${r}/index`));
}

interface TopBarProps {
  scrollY?: Animated.Value;
}

export function TopBar({ scrollY }: TopBarProps = {}): React.JSX.Element | null {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const isRTLMode = isRTL(language);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const openProfile = useProfilePopupStore((s) => s.open);
  const profile = useAuthStore((s) => s.profile);
  const pathname = usePathname();

  const handleBack = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Walk one step back; goBack already collapses to home when at the root.
    goBack();
  }, []);

  const handleProfilePress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    openProfile('end'); // avatar sits on the trailing edge of this bar
  }, [openProfile]);

  // Only the legacy screens without their own header still get the shared bar.
  if (!needsTopBar(pathname)) return null;

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
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
      >
        <Ionicons
          name={isRTLMode ? 'chevron-forward' : 'chevron-back'}
          size={24}
          color={c.primary}
        />
      </Pressable>

      <Text style={[styles.appName, { color: c.primary }]}>HouseMates</Text>

      {/* Right: avatar */}
      <Pressable
        style={styles.iconBtn}
        onPress={handleProfilePress}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.open_profile')}
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: profile?.avatarUrl
                ? 'transparent'
                : (profile?.avatarColor ?? c.primary),
            },
          ]}
        >
          {profile?.avatarUrl ? (
            <Image
              source={{ uri: profile.avatarUrl }}
              style={styles.avatarImg}
              contentFit="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{initial}</Text>
          )}
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
    paddingBottom: ms(14),
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appName: {
    flex: 1,
    fontSize: mf(20),
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
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: ms(34), height: ms(34) },
  avatarText: { color: '#fff', fontSize: mf(14), ...font.bold },
});
