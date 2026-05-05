import { useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Animated, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
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

export interface Props {}

export function ProfilePopup(): React.JSX.Element {
  const c       = useColors();
  const insets  = useSafeAreaInsets();
  const isOpen  = useProfilePopupStore((s) => s.isOpen);
  const close   = useProfilePopupStore((s) => s.close);
  const pathname = usePathname();

  useEffect(() => { close(); }, [pathname, close]);
  const profile = useAuthStore((s) => s.profile);
  const user    = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const initial = (profile?.name || user?.email || '?')[0]?.toUpperCase() ?? '?';

  const handleSignOut = useCallback(async (): Promise<void> => {
    try {
      await signOut();
      router.replace('/(auth)/welcome');
    } catch {
      Alert.alert('Sign out failed', 'Could not sign you out. Please try again.');
    }
  }, [signOut]);

  const MENU_ITEMS = useMemo((): MenuItem[] => [
    { icon: 'person-outline',   label: 'View Profile', href: '/(tabs)/profile' },
    { icon: 'settings-outline', label: 'Settings',     href: '/(tabs)/more/settings' },
    { icon: 'log-out-outline',  label: 'Sign out',     onPress: handleSignOut, danger: true },
  ], [handleSignOut]);

  const handleMenuPress = useCallback((item: MenuItem): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
    if (item.href) {
      router.push(item.href as Parameters<typeof router.push>[0]);
    } else if (item.onPress) {
      Promise.resolve(item.onPress()).catch(() => {
        Alert.alert('Action failed', 'Something went wrong. Please try again.');
      });
    }
  }, [close]);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 14,
      }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [isOpen, anim]);

  const opacity    = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1],    extrapolate: 'clamp' });
  const scale      = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1], extrapolate: 'clamp' });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0],   extrapolate: 'clamp' });

  // Drop just below the avatar in the top-right corner
  const dropdownTop = insets.top + 62;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'box-none' : 'none'}>
      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: c.surface,
            top: dropdownTop,
            opacity,
            transform: [{ scale }, { translateY }],
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        {/* Compact user identity header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <View style={[
            styles.avatar,
            { backgroundColor: profile?.avatarUrl ? 'transparent' : (profile?.avatarColor ?? c.primary) },
          ]}>
            {profile?.avatarUrl
              ? <Image
                  source={{ uri: profile.avatarUrl }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  accessibilityLabel={`${profile?.name ?? 'User'}'s avatar`}
                />
              : <Text style={[styles.avatarInitial, { color: c.white }]}>{initial}</Text>
            }
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerName, { color: c.textPrimary }]} numberOfLines={1}>
              {profile?.name ?? 'You'}
            </Text>
            <Text style={[styles.headerEmail, { color: c.textSecondary }]} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
        </View>

        {/* Menu rows */}
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => handleMenuPress(item)}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ disabled: false, selected: false }}
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={item.danger ? c.negative : c.textSecondary}
              style={styles.rowIcon}
            />
            <Text style={[styles.rowLabel, { color: item.danger ? c.negative : c.textPrimary }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    right: 16,
    width: 220,
    borderRadius: sizes.borderRadiusLg,
    paddingVertical: sizes.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingHorizontal: sizes.md,
    paddingTop: sizes.sm + 2,
    paddingBottom: sizes.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: sizes.xs,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg:     { width: 36, height: 36 },
  avatarInitial: { fontSize: 15, ...font.bold },
  headerText:    { flex: 1 },
  headerName:    { fontSize: sizes.fontSm, ...font.semibold },
  headerEmail:   { fontSize: sizes.fontXs, ...font.regular, marginTop: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sizes.md,
    paddingVertical: sizes.sm,
    gap: sizes.sm,
    minHeight: sizes.touchTarget,
  },
  rowPressed: { opacity: 0.6 },
  rowIcon:    { width: 20, textAlign: 'center' },
  rowLabel:   { flex: 1, fontSize: sizes.fontSm, ...font.medium },
});
