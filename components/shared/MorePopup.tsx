import { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
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

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface NavItem {
  icon: IoniconName;
  iconActive: IoniconName;
  labelKey: string;
  route: string;
  featureKey?: string;
  badgeKey?: BadgeFeature;
}

const POPUP_NAV: NavItem[] = [
  { icon: 'cart-outline',           iconActive: 'cart',           labelKey: 'nav.grocery',    route: '/(tabs)/grocery',       featureKey: 'grocery' },
  { icon: 'checkmark-done-outline', iconActive: 'checkmark-done', labelKey: 'nav.chores',     route: '/(tabs)/chores',        featureKey: 'chores' },
  { icon: 'calendar-outline',       iconActive: 'calendar',       labelKey: 'nav.calendar',   route: '/(tabs)/calendar' },
  { icon: 'images-outline',         iconActive: 'images',         labelKey: 'nav.photos',     route: '/(tabs)/photos' },
  { icon: 'people-outline',         iconActive: 'people',         labelKey: 'nav.housemates', route: '/(tabs)/bills/setup' },
  { icon: 'hand-left-outline',      iconActive: 'hand-left',      labelKey: 'nav.votes',      route: '/(tabs)/voting',        featureKey: 'voting' },
  { icon: 'construct-outline',      iconActive: 'construct',      labelKey: 'nav.property',   route: '/(tabs)/property',      featureKey: 'maintenance' },
];

type GenericItem = { createdAt: string; [k: string]: unknown };

export function MorePopup(): React.JSX.Element {
  const c       = useColors();
  const { t }   = useTranslation();
  const insets  = useSafeAreaInsets();
  const isOpen  = useMorePopupStore((s) => s.isOpen);
  const close   = useMorePopupStore((s) => s.close);

  const settingsFeatures = useSettingsStore((s) => s.features);
  const permissions      = useAuthStore((s) => s.permissions);
  const profile          = useAuthStore((s) => s.profile);
  const myId             = profile?.id ?? '';

  const proposals        = useVotingStore((s) => s.proposals);
  const maintenanceItems = useMaintenanceStore((s) => s.requests);
  const groceryItems     = useGroceryStore((s) => s.items);
  const chores           = useChoresStore((s) => s.chores);
  const lastSeen         = useBadgeStore((s) => s.lastSeen);
  const markSeen         = useBadgeStore((s) => s.markSeen);

  const badgeCounts: Record<string, number> = {
    grocery:     countNew(groceryItems.filter((i) => !i.isChecked) as unknown as GenericItem[], lastSeen.grocery, myId, 'addedBy'),
    chores:      countNewSimple(chores.filter((ch) => !ch.isComplete), lastSeen.chores),
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

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 68, friction: 12 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [isOpen, anim]);

  const backdropOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5], extrapolate: 'clamp' });
  const translateY      = anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0],  extrapolate: 'clamp' });

  const handleNav = useCallback((item: NavItem): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    close();
    const featureToMark = item.badgeKey ?? (item.featureKey as BadgeFeature | undefined);
    if (featureToMark) markSeen(featureToMark).catch(() => {});
    router.push(item.route as Parameters<typeof router.push>[0]);
  }, [close, markSeen]);

  const visibleItems = filterNav(POPUP_NAV);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      {/* Sliding panel */}
      <Animated.View style={[
        styles.panel,
        { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] },
      ]}>
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
        </View>

        {/* Section label */}
        <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>{t('nav.house_section')}</Text>

        {/* 3-column grid */}
        <View style={styles.grid}>
          {visibleItems.map((item) => {
            const count = item.featureKey ? (badgeCounts[item.featureKey] ?? 0) : 0;

            return (
              <Pressable
                key={item.route}
                style={({ pressed }) => [styles.gridItem, pressed && styles.gridItemPressed]}
                onPress={() => handleNav(item)}
                accessibilityRole="button"
                accessibilityLabel={t(item.labelKey)}
              >
                <View style={[styles.iconWrap, { backgroundColor: c.primary + '14' }]}>
                  <Ionicons name={item.icon} size={22} color={c.primary} />
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
  sectionLabel: {
    fontSize: sizes.fontXxs,
    ...font.semibold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: sizes.sm,
    marginLeft: sizes.xs,
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
    width: 52,
    height: 52,
    borderRadius: sizes.borderRadius,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, ...font.bold },
  gridLabel: { fontSize: sizes.fontXs, ...font.semibold, textAlign: 'center' },
});
