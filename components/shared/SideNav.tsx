import { useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { router, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useBillsStore } from '@stores/billsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useVotingStore } from '@stores/votingStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { useBadgeStore, countNew, countNewSimple } from '@stores/badgeStore';
import { hasFeatureAccess } from '@utils/featureAccess';
import { useColors } from '@hooks/useColors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { SIDENAV_WIDTH } from '@utils/responsive';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface NavEntry {
  id: string;
  icon: IoniconName;
  iconActive: IoniconName;
  labelKey: string;
  route: string;
  // The house-wide feature key gating this item, when it has one. Structural
  // items (Home) have none and are always shown.
  featureKey?: string;
}

// Primary sections — the same three the phone's bottom bar shows.
const PRIMARY: NavEntry[] = [
  {
    id: 'dashboard',
    icon: 'home-outline',
    iconActive: 'home',
    labelKey: 'nav.dashboard',
    route: '/(tabs)/dashboard',
  },
  {
    id: 'bills',
    icon: 'card-outline',
    iconActive: 'card',
    labelKey: 'nav.bills',
    route: '/(tabs)/bills',
    featureKey: 'bills',
  },
  {
    id: 'parking',
    icon: 'car-outline',
    iconActive: 'car',
    labelKey: 'nav.parking',
    route: '/(tabs)/parking',
    featureKey: 'parking',
  },
];

// Everything the phone reaches through the "More" sheet — mirrors POPUP_NAV so
// the two never drift.
const HOUSE: NavEntry[] = [
  {
    id: 'grocery',
    icon: 'cart-outline',
    iconActive: 'cart',
    labelKey: 'nav.grocery',
    route: '/(tabs)/grocery',
    featureKey: 'grocery',
  },
  {
    id: 'machines',
    icon: 'sync-outline',
    iconActive: 'sync',
    labelKey: 'nav.machines',
    route: '/(tabs)/machines',
  },
  {
    id: 'calendar',
    icon: 'calendar-outline',
    iconActive: 'calendar',
    labelKey: 'nav.calendar',
    route: '/(tabs)/calendar',
  },
  {
    id: 'photos',
    icon: 'images-outline',
    iconActive: 'images',
    labelKey: 'nav.photos',
    route: '/(tabs)/photos',
  },
  {
    id: 'tasks',
    icon: 'list-outline',
    iconActive: 'list',
    labelKey: 'nav.tasks',
    route: '/(tabs)/tasks',
  },
  {
    id: 'notes',
    icon: 'clipboard-outline',
    iconActive: 'clipboard',
    labelKey: 'nav.notes',
    route: '/(tabs)/notes',
  },
  {
    id: 'voting',
    icon: 'hand-left-outline',
    iconActive: 'hand-left',
    labelKey: 'nav.votes',
    route: '/(tabs)/voting',
    featureKey: 'voting',
  },
  {
    id: 'property',
    icon: 'construct-outline',
    iconActive: 'construct',
    labelKey: 'nav.property',
    route: '/(tabs)/property',
    featureKey: 'maintenance',
  },
];

/**
 * The desktop-only left navigation rail. Rendered by the root layout in place of
 * the bottom tab bar once the window is wide enough (see isDesktop). It surfaces
 * every section the phone splits across the bottom bar + the "More" sheet, plus
 * the add-expense action, settings, and the profile menu.
 */
export function SideNav(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useColors();
  const pathname = usePathname();

  const profile = useAuthStore((s) => s.profile);
  const permissions = useAuthStore((s) => s.permissions);
  const features = useSettingsStore((s) => s.features);
  const openProfile = useProfilePopupStore((s) => s.open);

  const myId = profile?.id ?? '';
  const lastSeen = useBadgeStore((s) => s.lastSeen);

  // Badges — the same counts the phone shows on the bottom bar and More sheet,
  // so a desktop user sees identical "needs attention" signals.
  const bills = useBillsStore((s) => s.bills);
  const reservations = useParkingStore((s) => s.reservations);
  const groceryItems = useGroceryStore((s) => s.items);
  const proposals = useVotingStore((s) => s.proposals);
  const maintenanceItems = useMaintenanceStore((s) => s.requests);

  const badges: Record<string, number> = {
    bills: countNewSimple(
      bills.filter((b) => !b.settled),
      lastSeen.bills
    ),
    parking: myId
      ? reservations.filter(
          (r) =>
            r.status === 'pending' &&
            r.requestedBy !== myId &&
            !r.votes.some((v) => v.userId === myId)
        ).length
      : 0,
    grocery: myId
      ? countNew(
          groceryItems.filter((i) => !i.isChecked && !i.isDraft),
          lastSeen.grocery,
          myId,
          'addedBy'
        )
      : 0,
    voting: myId
      ? proposals.filter(
          (p) => p.isOpen && p.createdBy !== myId && !p.votes.some((v) => v.person === myId)
        ).length
      : 0,
    property: countNewSimple(
      maintenanceItems.filter((m) => m.status === 'open'),
      lastSeen.maintenance
    ),
  };

  const canShow = useCallback(
    (entry: NavEntry): boolean =>
      entry.featureKey ? hasFeatureAccess(entry.featureKey, features, permissions) : true,
    [features, permissions]
  );

  const isActive = useCallback((id: string): boolean => pathname.includes(`/${id}`), [pathname]);

  const handleNav = useCallback((route: string): void => {
    navigateToBase(route);
  }, []);

  const handleAdd = useCallback((): void => {
    router.push('/(tabs)/bills/add');
  }, []);

  const handleSettings = useCallback((): void => {
    navigateToBase('/(tabs)/more/settings');
  }, []);

  const handleProfile = useCallback((): void => {
    openProfile('start');
  }, [openProfile]);

  const canAddBill = hasFeatureAccess('bills', features, permissions);
  const initial = profile?.name ? profile.name[0].toUpperCase() : '?';
  const settingsActive = pathname.includes('/settings');

  const renderItem = (entry: NavEntry): React.JSX.Element | null => {
    if (!canShow(entry)) return null;
    const active = isActive(entry.id);
    const count = badges[entry.id] ?? 0;
    return (
      <Pressable
        key={entry.id}
        onPress={() => handleNav(entry.route)}
        accessible
        accessibilityRole="tab"
        accessibilityLabel={t(entry.labelKey)}
        accessibilityState={{ selected: active }}
        style={({ pressed }) => [
          styles.item,
          active && { backgroundColor: c.primaryTint },
          pressed && !active && { backgroundColor: c.borderLight },
        ]}
      >
        <View style={styles.itemIcon}>
          <Ionicons
            name={active ? entry.iconActive : entry.icon}
            size={22}
            color={active ? c.primary : c.textSecondary}
          />
          {count > 0 && (
            <View style={[styles.badge, { backgroundColor: c.danger, borderColor: c.surface }]}>
              <Text style={[styles.badgeText, { color: c.white }]}>
                {count > 9 ? '9+' : String(count)}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.itemLabel, { color: active ? c.primary : c.textPrimary }]}
          numberOfLines={1}
        >
          {t(entry.labelKey)}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.rail, { backgroundColor: c.surface, borderRightColor: c.border }]}>
      {/* Brand */}
      <View style={styles.brand}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.brandMark}
          contentFit="contain"
        />
        <Text style={[styles.brandName, { color: c.primary }]} numberOfLines={1}>
          HouseMates
        </Text>
      </View>

      {/* Add expense */}
      {canAddBill && (
        <Pressable
          onPress={handleAdd}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.add_expense_btn')}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: c.primary },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={20} color={c.white} />
          <Text style={[styles.addLabel, { color: c.white }]} numberOfLines={1}>
            {t('dashboard.add_expense_btn')}
          </Text>
        </Pressable>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {PRIMARY.map(renderItem)}
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        {HOUSE.map(renderItem)}
      </ScrollView>

      {/* Footer: settings + profile */}
      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <Pressable
          onPress={handleSettings}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('nav.settings')}
          accessibilityState={{ selected: settingsActive }}
          style={({ pressed }) => [
            styles.item,
            settingsActive && { backgroundColor: c.primaryTint },
            pressed && !settingsActive && { backgroundColor: c.borderLight },
          ]}
        >
          <View style={styles.itemIcon}>
            <Ionicons
              name="settings-outline"
              size={22}
              color={settingsActive ? c.primary : c.textSecondary}
            />
          </View>
          <Text
            style={[styles.itemLabel, { color: settingsActive ? c.primary : c.textPrimary }]}
            numberOfLines={1}
          >
            {t('nav.settings')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleProfile}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.open_profile')}
          style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.borderLight }]}
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
          <Text style={[styles.itemLabel, { color: c.textPrimary }]} numberOfLines={1}>
            {profile?.name ?? t('dashboard.open_profile')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: SIDENAV_WIDTH,
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: sizes.sm,
    paddingTop: sizes.lg,
    paddingBottom: sizes.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingHorizontal: sizes.sm,
    marginBottom: sizes.lg,
  },
  brandMark: { width: 32, height: 32, borderRadius: sizes.borderRadiusSm },
  brandName: { fontSize: sizes.fontXl, ...font.extrabold, letterSpacing: -0.6, flexShrink: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizes.xs,
    height: 44,
    borderRadius: sizes.borderRadius,
    marginBottom: sizes.md,
  },
  addLabel: { fontSize: sizes.fontMd, ...font.bold },
  pressed: { opacity: 0.85 },
  scroll: { flex: 1 },
  scrollContent: { gap: 2, paddingBottom: sizes.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.md,
    minHeight: 44,
    paddingHorizontal: sizes.sm,
    borderRadius: sizes.borderRadius,
  },
  itemIcon: { width: 24, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  itemLabel: { fontSize: sizes.fontMd, ...font.semibold, flexShrink: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: sizes.sm,
    marginHorizontal: sizes.sm,
  },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: sizes.sm, gap: 2 },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 24, height: 24 },
  avatarText: { color: '#fff', fontSize: sizes.fontXs, ...font.bold },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: { fontSize: 9, ...font.bold },
});
