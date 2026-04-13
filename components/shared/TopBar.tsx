import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useDrawerStore } from '@stores/drawerStore';
import { useAuthStore } from '@stores/authStore';
import { useBadgeStore, countNew, countNewSimple } from '@stores/badgeStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useChoresStore } from '@stores/choresStore';
import { useVotingStore } from '@stores/votingStore';
import { useMaintenanceStore } from '@stores/maintenanceStore';
import { useBillsStore } from '@stores/billsStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export function TopBar(): React.JSX.Element {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const toggle = useDrawerStore((s) => s.toggle);
  const profile = useAuthStore((s) => s.profile);

  // Badge counts — same logic as DrawerMenu
  const lastSeen          = useBadgeStore((s) => s.lastSeen);
  const myName            = profile?.name ?? '';
  const parkingReservations = useParkingStore((s) => s.reservations);
  const groceryItems      = useGroceryStore((s) => s.items);
  const chores            = useChoresStore((s) => s.chores);
  const proposals         = useVotingStore((s) => s.proposals);
  const maintenanceItems  = useMaintenanceStore((s) => s.requests);
  const bills             = useBillsStore((s) => s.bills);

  type GenericItem = Array<{ createdAt: string; [k: string]: unknown }>;
  // Cast to the generic shape that countNew / countNewSimple expect
  const totalBadge =
    countNew(parkingReservations as unknown as GenericItem, lastSeen.parking, myName, 'occupant') +
    countNew((groceryItems.filter((i) => !i.isChecked)) as unknown as GenericItem, lastSeen.grocery, myName, 'addedBy') +
    countNewSimple(chores.filter((c) => !c.isComplete), lastSeen.chores) +
    countNewSimple(bills.filter((b) => !b.settled), lastSeen.bills) +
    countNew((proposals.filter((p) => p.isOpen)) as unknown as GenericItem, lastSeen.voting, myName, 'createdBy') +
    countNewSimple(maintenanceItems.filter((m) => m.status === 'open'), lastSeen.maintenance);

  const handleMenuPress = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggle();
  };

  const handleProfilePress = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/(tabs)/profile');
  };

  const initial = profile?.name ? profile.name[0].toUpperCase() : '?';

  return (
    <View style={[styles.bar, { paddingTop: insets.top + sizes.sm }]}>
      <Pressable
        style={styles.menuBtn}
        onPress={handleMenuPress}
        accessibilityRole="button"
        accessibilityLabel={t('settings.open_menu')}
        accessible={true}
      >
        <View style={styles.hamburger}>
          <View style={[styles.line, styles.lineTop]} />
          <View style={[styles.line, styles.lineMid]} />
          <View style={[styles.line, styles.lineBot]} />
        </View>
        {totalBadge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalBadge > 99 ? '99+' : String(totalBadge)}</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.appName}>HouseMates</Text>

      <Pressable
        style={styles.avatarBtn}
        onPress={handleProfilePress}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        accessible={true}
      >
        <View style={[styles.avatar, { backgroundColor: profile?.avatarColor ?? colors.primary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.sm,
    paddingHorizontal: sizes.md,
    paddingBottom: 14,
    boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
  } as never,
  appName: {
    flex: 1,
    fontSize: 20,
    ...font.extrabold,
    color: colors.primary,
    letterSpacing: -0.8,
  },
  menuBtn: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  hamburger: { gap: 5, alignItems: 'flex-start' },
  line: { height: 2, backgroundColor: colors.primary, borderRadius: 2 },
  lineTop: { width: 22 },
  lineMid: { width: 14 },
  lineBot: { width: 22 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    ...font.bold,
    lineHeight: 13,
  },
  avatarBtn: {
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
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    ...font.bold,
  },
});
