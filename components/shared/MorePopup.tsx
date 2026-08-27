import { useEffect, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { usePathname } from 'expo-router';
import { navigateToBase } from '@stores/navigationStore';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMorePopupStore } from '@stores/morePopupStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useVotingStore } from '@stores/votingStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useBadgeStore, countNew, countNewSimple, type BadgeFeature } from '@stores/badgeStore';
import { useColors } from '@hooks/useColors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

import { mf, ms } from '@utils/responsive';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
const webFixedOverlay = { position: 'fixed' } as unknown as ViewStyle;

interface NavItem {
  icon: IoniconName;
  iconActive: IoniconName;
  labelKey: string;
  route: string;
  color: string;
  featureKey?: string;
  badgeKey?: BadgeFeature;
}

// Each feature gets its own accent (like the dashboard tiles) instead of every
// icon sharing the blue primary — makes the grid easier to scan. Fixed hues
// that read well on both the cream and navy surfaces.
const POPUP_NAV: NavItem[] = [
  {
    icon: 'cart-outline',
    iconActive: 'cart',
    labelKey: 'nav.grocery',
    route: '/(tabs)/grocery',
    color: '#E8892B',
    featureKey: 'grocery',
  },
  {
    icon: 'calendar-outline',
    iconActive: 'calendar',
    labelKey: 'nav.calendar',
    route: '/(tabs)/calendar',
    color: '#3B6FBF',
  },
  {
    icon: 'images-outline',
    iconActive: 'images',
    labelKey: 'nav.photos',
    route: '/(tabs)/photos',
    color: '#AF52DE',
  },
  // Housemates intentionally omitted here — they're managed under Settings, so
  // surfacing them in this menu too was redundant.
  {
    icon: 'list-outline',
    iconActive: 'list',
    labelKey: 'nav.tasks',
    route: '/(tabs)/tasks',
    color: '#2FA37A',
  },
  {
    icon: 'clipboard-outline',
    iconActive: 'clipboard',
    labelKey: 'nav.notes',
    route: '/(tabs)/notes',
    color: '#D9A414',
  },
  {
    icon: 'hand-left-outline',
    iconActive: 'hand-left',
    labelKey: 'nav.votes',
    route: '/(tabs)/voting',
    color: '#EC5A8D',
    featureKey: 'voting',
  },
  {
    icon: 'construct-outline',
    iconActive: 'construct',
    labelKey: 'nav.property',
    route: '/(tabs)/property',
    color: '#12A594',
    featureKey: 'maintenance',
  },
];

export function MorePopup(): React.JSX.Element {
  const c = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOpen = useMorePopupStore((s) => s.isOpen);
  const close = useMorePopupStore((s) => s.close);
  const pathname = usePathname();

  // When true, the next close skips the slide-down and snaps shut instantly.
  // Used whenever the menu closes because we're navigating away — otherwise the
  // 200ms close animation gets interrupted by the route change and visibly
  // "finishes" over the next screen (and again on the way back).
  const skipCloseAnim = useRef(false);

  const settingsFeatures = useSettingsStore((s) => s.features);
  const permissions = useAuthStore((s) => s.permissions);
  const profile = useAuthStore((s) => s.profile);
  const myId = profile?.id ?? '';

  const proposals = useVotingStore((s) => s.proposals);
  const maintenanceItems = useMaintenanceStore((s) => s.requests);
  const groceryItems = useGroceryStore((s) => s.items);
  const chores = useChoresStore((s) => s.chores);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const markSeen = useBadgeStore((s) => s.markSeen);

  const badgeCounts: Record<string, number> = {
    grocery: countNew(
      groceryItems.filter((i) => !i.isChecked && !i.isDraft),
      lastSeen.grocery,
      myId,
      'addedBy'
    ),
    chores: countNewSimple(
      chores.filter((ch) => !ch.isComplete),
      lastSeen.chores
    ),
    voting: myId
      ? proposals.filter(
          (p) => p.isOpen && p.createdBy !== myId && !p.votes.some((v) => v.person === myId)
        ).length
      : 0,
    maintenance: countNewSimple(
      maintenanceItems.filter((m) => m.status === 'open'),
      lastSeen.maintenance
    ),
  };

  const filterNav = useCallback(
    (items: NavItem[]): NavItem[] =>
      items.filter((item) => {
        if (!item.featureKey) return true;
        if (!(settingsFeatures.find((f) => f.key === item.featureKey)?.enabled ?? false))
          return false;
        const key = item.featureKey as keyof typeof permissions;
        if (permissions && key in permissions && !permissions[key]) return false;
        return true;
      }),
    [settingsFeatures, permissions]
  );

  const [panelMounted, setPanelMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect((): void => {
    if (isOpen) {
      setPanelMounted(true);
      skipCloseAnim.current = false;
      Animated.spring(anim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    } else if (skipCloseAnim.current) {
      // Navigating away — snap shut with no animation so nothing lingers over
      // the next screen or replays when coming back.
      skipCloseAnim.current = false;
      anim.setValue(0);
      setPanelMounted(false);
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setPanelMounted(false);
        }
      );
    }
  }, [isOpen, anim]);

  // If the menu is still open when the route changes (e.g. a back-swipe while
  // it's up), snap it shut instantly rather than sliding — a slide would play
  // over the next screen.
  useEffect((): void => {
    skipCloseAnim.current = true;
    close();
  }, [pathname, close]);

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
    extrapolate: 'clamp',
  });
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
    extrapolate: 'clamp',
  });

  const handleClose = useCallback((): void => {
    close();
  }, [close]);

  // The route the user picked, navigated once the menu has finished sliding
  // closed. Letting the menu animate shut first means Home paints several clean
  // (menu-free) frames before we route away — so the picture iOS Safari keeps of
  // Home for its back-swipe has no menu in it, and the close still looks smooth
  // instead of the menu snapping away.
  const pendingRoute = useRef<string | null>(null);
  useEffect((): void => {
    if (!panelMounted && pendingRoute.current) {
      const route = pendingRoute.current;
      pendingRoute.current = null;
      navigateToBase(route);
    }
  }, [panelMounted]);

  const handleNav = useCallback(
    (item: NavItem): void => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const featureToMark = item.badgeKey ?? (item.featureKey as BadgeFeature | undefined);
      if (featureToMark) markSeen(featureToMark).catch(() => {});
      // Close with the normal slide-down (do NOT skip the animation), and let the
      // effect above navigate once the panel has fully closed.
      pendingRoute.current = item.route;
      close();
    },
    [close, markSeen]
  );

  const visibleItems = filterNav(POPUP_NAV);

  return (
    <View
      style={[styles.overlay, process.env.EXPO_OS === 'web' && webFixedOverlay]}
      pointerEvents={isOpen ? 'auto' : 'none'}
    >
      {panelMounted && (
        <>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleClose}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            />
          </Animated.View>

          {/* Sliding panel */}
          <Animated.View
            style={[
              styles.panel,
              {
                backgroundColor: c.surface,
                paddingBottom: Math.max(insets.bottom, 16),
                transform: [{ translateY }],
              },
            ]}
          >
            {/* Drag handle */}
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: c.border }]} />
            </View>

            {/* Section label */}
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
              {t('nav.house_section')}
            </Text>

            {/* 3-column grid */}
            <View style={styles.grid}>
              {visibleItems.map((item) => {
                const count = item.featureKey ? (badgeCounts[item.featureKey] ?? 0) : 0;

                return (
                  <Pressable
                    key={item.route}
                    style={({ pressed }) => [styles.gridItem, pressed && styles.gridItemPressed]}
                    onPress={() => handleNav(item)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={t(item.labelKey)}
                    accessibilityState={{ disabled: false }}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: item.color + '1F' }]}>
                      <Ionicons name={item.icon} size={22} color={item.color} />
                      {count > 0 && (
                        <View style={[styles.badge, { backgroundColor: c.danger }]}>
                          <Text style={[styles.badgeText, { color: c.white }]}>
                            {count > 9 ? '9+' : String(count)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.gridLabel, { color: c.textPrimary }]} numberOfLines={1}>
                      {t(item.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
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
    shadowOffset: { width: 0, height: ms(-4) },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 24,
  },
  handleWrap: { alignItems: 'center', paddingVertical: sizes.sm },
  handle: { width: ms(36), height: ms(4), borderRadius: ms(2) },
  sectionLabel: {
    fontSize: sizes.fontXxs,
    ...font.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: sizes.sm,
    marginStart: sizes.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: sizes.md,
    gap: sizes.sm,
  },
  gridItemPressed: { opacity: 0.65 },
  iconWrap: {
    width: ms(52),
    height: ms(52),
    borderRadius: sizes.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: ms(-4),
    end: ms(-4),
    minWidth: ms(16),
    height: ms(16),
    borderRadius: ms(8),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: ms(3),
  },
  badgeText: { fontSize: mf(9), ...font.bold },
  gridLabel: { fontSize: sizes.fontXs, ...font.semibold, textAlign: 'center' },
});
