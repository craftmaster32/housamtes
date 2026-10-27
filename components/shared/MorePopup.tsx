import { useEffect, useRef, useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, Animated, Platform } from 'react-native';
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
import { useTasksStore } from '@stores/tasksStore';
import { useBadgeStore, countNew, countNewSimple, type BadgeFeature } from '@stores/badgeStore';
import { useColors } from '@hooks/useColors';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

import { mf, ms } from '@utils/responsive';
import { asWord } from '@utils/asWord';
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
    icon: 'sync-outline',
    iconActive: 'sync',
    labelKey: 'nav.machines',
    route: '/(tabs)/machines',
    color: '#3B6FBF',
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
    badgeKey: 'chores',
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
  // The web build doesn't flip `end` for Hebrew, so there the side is picked by
  // hand — otherwise the close button sat over the title on the right. The
  // phone app flips `end` itself.
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const closeSide =
    Platform.OS !== 'web' ? styles.closeEnd : rtl ? styles.closeRtl : styles.closeLtr;
  const pathname = usePathname();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();

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
  const tasks = useTasksStore((s) => s.tasks);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const markSeen = useBadgeStore((s) => s.markSeen);

  const badgeCounts: Record<string, number> = {
    grocery: countNew(
      groceryItems.filter((i) => !i.isChecked && !i.isDraft),
      lastSeen.grocery,
      myId,
      'addedBy'
    ),
    // Chores live in the Tasks list now; the badge keeps its 'chores' key.
    chores: countNew(
      tasks.filter((tk) => !tk.isComplete),
      lastSeen.chores,
      myId,
      'createdBy'
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
                backgroundColor: c.background,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: c.border }]} />
            </View>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.close,
                closeSide,
                { backgroundColor: c.surface },
                pressed && styles.closePressed,
              ]}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={20} color={c.textSecondary} />
            </Pressable>

            {/* The menu is a notebook page: title on the top line, the pages two to a row. */}
            <NotebookPaper contentStyle={styles.page}>
              <Text
                style={[styles.title, heading, { color: c.paperInk }]}
                accessibilityRole="header"
              >
                {asWord(t('nav.house_section'))}
              </Text>
              <View style={styles.grid}>
                {visibleItems.map((item) => {
                  const badgeFor = item.badgeKey ?? item.featureKey;
                  const count = badgeFor ? (badgeCounts[badgeFor] ?? 0) : 0;
                  return (
                    <Pressable
                      key={item.route}
                      style={styles.gridItem}
                      onPress={() => handleNav(item)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={
                        count > 0 ? `${t(item.labelKey)}, ${count}` : t(item.labelKey)
                      }
                    >
                      {({ pressed }) => (
                        <>
                          <Ionicons name={item.icon} size={21} color={item.color} />
                          <View style={styles.labelWrap}>
                            {/* A highlighter swipe while the finger is down. */}
                            {pressed && <View style={styles.highlight} />}
                            <Text
                              style={[styles.gridLabel, { color: c.paperInk }]}
                              numberOfLines={1}
                            >
                              {t(item.labelKey)}
                            </Text>
                          </View>
                          {count > 0 && (
                            <View style={[styles.badge, { borderColor: c.danger }]}>
                              <Text style={[styles.badgeText, hand, { color: c.danger }]}>
                                {count > 9 ? '9+' : String(count)}
                              </Text>
                            </View>
                          )}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </NotebookPaper>
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
  handle: { width: ms(40), height: ms(5), borderRadius: ms(3) },
  close: {
    position: 'absolute',
    top: ms(14),
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeEnd: { end: ms(16) },
  closeLtr: { right: ms(16) },
  closeRtl: { left: ms(16) },
  closePressed: { opacity: 0.7 },
  page: { paddingTop: ms(12), paddingStart: ms(52), paddingEnd: ms(14), paddingBottom: ms(16) },
  title: { fontSize: mf(28), lineHeight: mf(36), letterSpacing: -0.4, marginBottom: ms(4) },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '50%',
    minHeight: ms(52),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(9),
    paddingEnd: ms(6),
  },
  labelWrap: { flexShrink: 1, justifyContent: 'center' },
  highlight: {
    position: 'absolute',
    left: -ms(5),
    right: -ms(7),
    top: '42%',
    height: ms(13),
    borderRadius: ms(5),
    backgroundColor: 'rgba(255,214,10,0.55)',
    transform: [{ rotate: '-1.2deg' }],
  },
  gridLabel: { fontSize: mf(15.5), ...font.semibold },
  // The count, circled in red pen.
  badge: {
    minWidth: ms(26),
    height: ms(26),
    borderRadius: ms(13),
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(3),
    transform: [{ rotate: '-6deg' }],
  },
  badgeText: { fontSize: mf(17), lineHeight: mf(20) },
});
