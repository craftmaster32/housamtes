import { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { router, Link } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useAuthStore } from '@stores/authStore';
import { useColors } from '@hooks/useColors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  icon: IoniconName;
  label: string;
  href?: string;
  onPress?: () => Promise<void> | void;
  danger?: boolean;
}

export function ProfilePopup(): React.JSX.Element {
  const c       = useColors();
  const insets  = useSafeAreaInsets();
  const isOpen  = useProfilePopupStore((s) => s.isOpen);
  const close   = useProfilePopupStore((s) => s.close);
  const profile = useAuthStore((s) => s.profile);
  const user    = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  // Guard against empty string — `??` keeps '' which gives undefined at [0]
  const initial = (profile?.name || user?.email || '?')[0]?.toUpperCase() ?? '?';

  const handleHapticClose = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
  }, [close]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    close();
    try {
      await signOut();
      router.replace('/(auth)/welcome');
    } catch {
      Alert.alert('Sign out failed', 'Could not sign you out. Please try again.');
    }
  }, [close, signOut]);

  const MENU_ITEMS = useMemo((): MenuItem[] => [
    { icon: 'person-outline',   label: 'View Profile', href: '/(tabs)/profile' },
    { icon: 'settings-outline', label: 'Settings',     href: '/(tabs)/more/settings' },
    { icon: 'log-out-outline',  label: 'Sign out',     onPress: handleSignOut, danger: true },
  ], [handleSignOut]);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 68, friction: 12 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isOpen, anim]);

  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5], extrapolate: 'clamp' });
  const translateY      = anim.interpolate({ inputRange: [0, 1], outputRange: [300, 0],  extrapolate: 'clamp' });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Close profile menu"
        />
      </Animated.View>

      <Animated.View style={[
        styles.panel,
        { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
      ]}>
        {/* Handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>

        {/* Profile identity */}
        <View style={[styles.identity, { borderBottomColor: c.border }]}>
          <View style={[styles.avatar, { backgroundColor: profile?.avatarUrl ? 'transparent' : (profile?.avatarColor ?? c.primary) }]}>
            {profile?.avatarUrl
              ? <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} contentFit="cover" accessibilityLabel={`${profile?.name ?? 'User'}'s avatar`} />
              : <Text style={[styles.avatarInitial, { color: c.white }]}>{initial}</Text>
            }
          </View>
          <View style={styles.identityText}>
            <Text style={[styles.identityName, { color: c.textPrimary }]}>{profile?.name ?? 'You'}</Text>
            <Text style={[styles.identityEmail, { color: c.textSecondary }]} numberOfLines={1}>{user?.email ?? ''}</Text>
          </View>
        </View>

        {/* Menu items */}
        {MENU_ITEMS.map((item) => {
          const row = (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
              onPress={item.href ? handleHapticClose : item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Ionicons name={item.icon} size={20} color={item.danger ? c.negative : c.textSecondary} style={styles.rowIcon} />
              <Text style={[styles.rowLabel, { color: item.danger ? c.negative : c.textPrimary }]}>{item.label}</Text>
              {!item.danger && <Ionicons name="chevron-forward" size={16} color={c.textSecondary} />}
            </Pressable>
          );
          return item.href ? (
            <Link key={item.label} asChild href={item.href as Parameters<typeof router.push>[0]}>
              {row}
            </Link>
          ) : (
            <View key={item.label}>{row}</View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: sizes.borderRadiusXl,
    borderTopRightRadius: sizes.borderRadiusXl,
    paddingHorizontal: sizes.md,
    paddingTop: sizes.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 24,
  },
  handleWrap: { alignItems: 'center', paddingVertical: sizes.sm },
  handle: { width: 36, height: 4, borderRadius: 2 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.md,
    paddingVertical: sizes.md,
    marginBottom: sizes.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 48, height: 48 },
  avatarInitial: { fontSize: 20, ...font.bold },
  identityText: { flex: 1 },
  identityName: { fontSize: sizes.fontMd, ...font.semibold },
  identityEmail: { fontSize: sizes.fontXs, ...font.regular, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sizes.md,
    gap: sizes.md,
    minHeight: sizes.touchTarget,
  },
  rowIcon: { width: 24, textAlign: 'center' },
  rowLabel: { flex: 1, fontSize: sizes.fontMd, ...font.medium },
});
