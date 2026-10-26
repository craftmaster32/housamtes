import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { navigateToBase } from '@stores/navigationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useMorePopupStore } from '@stores/morePopupStore';
import { useProfilePopupStore } from '@stores/profilePopupStore';
import { useBadgeStore, countNew, countNewSimple } from '@stores/badgeStore';
import { useBillsStore } from '@stores/billsStore';
import { useParkingStore } from '@stores/parkingStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useTasksStore } from '@stores/tasksStore';
import { useVotingStore } from '@stores/votingStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { hasFeatureAccess } from '@utils/featureAccess';
import { useColors } from '@hooks/useColors';
import { sizes } from '@constants/sizes';
import { TabButton } from '@components/shared/tabbar/TabButton';
import { ParkingSignIcon } from '@components/shared/tabbar/ParkingSignIcon';

import { ms } from '@utils/responsive';
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabItem {
  id: string;
  icon: IoniconName;
  iconActive: IoniconName;
  label: string;
  route: string;
}

const TABS: TabItem[] = [
  {
    id: 'dashboard',
    icon: 'home-outline',
    iconActive: 'home',
    label: 'Home',
    route: '/(tabs)/dashboard',
  },
  { id: 'bills', icon: 'card-outline', iconActive: 'card', label: 'Bills', route: '/(tabs)/bills' },
  {
    id: 'parking',
    icon: 'car-outline',
    iconActive: 'car',
    label: 'Parking',
    route: '/(tabs)/parking',
  },
  {
    id: 'more',
    icon: 'ellipsis-horizontal',
    iconActive: 'ellipsis-horizontal',
    label: 'More',
    route: '',
  },
];

const ICON_SIZE = 27;

export function BottomTabBar(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useColors();

  const tabLabels: Record<string, string> = {
    dashboard: t('nav.dashboard'),
    bills: t('nav.bills'),
    parking: t('nav.parking'),
    more: t('nav.more'),
  };
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isMoreOpen = useMorePopupStore((s) => s.isOpen);
  const openMore = useMorePopupStore((s) => s.open);
  const closeMore = useMorePopupStore((s) => s.close);
  const closeProfile = useProfilePopupStore((s) => s.close);

  const bills = useBillsStore((s) => s.bills);
  const lastSeen = useBadgeStore((s) => s.lastSeen);
  const billBadge = countNewSimple(
    bills.filter((b) => !b.settled),
    lastSeen.bills
  );
  const reservations = useParkingStore((s) => s.reservations);
  const items = useGroceryStore((s) => s.items);
  const tasks = useTasksStore((s) => s.tasks);
  const proposals = useVotingStore((s) => s.proposals);
  const myId = useAuthStore((s) => s.profile?.id);
  const parkingBadge = myId
    ? reservations.filter(
        (r) =>
          r.status === 'pending' &&
          r.requestedBy !== myId &&
          !r.votes.some((v) => v.userId === myId)
      ).length
    : 0;
  const groceryBadge = myId
    ? countNew(
        items.filter((i) => !i.isDraft && !i.isChecked),
        lastSeen.grocery,
        myId,
        'addedBy'
      )
    : 0;
  // Chores live in the Tasks list now; the badge keeps its 'chores' key.
  const choresBadge = myId
    ? countNew(
        tasks.filter((tk) => !tk.isComplete),
        lastSeen.chores,
        myId,
        'createdBy'
      )
    : 0;
  const votingBadge = myId
    ? proposals.filter(
        (p) => p.isOpen && p.createdBy !== myId && !p.votes.some((v) => v.person === myId)
      ).length
    : 0;
  const moreBadge = groceryBadge + choresBadge + votingBadge;

  const isActive = useCallback(
    (id: string): boolean => {
      if (id === 'more') return isMoreOpen;
      return pathname.includes(`/${id}`);
    },
    [isMoreOpen, pathname]
  );

  const handleTab = useCallback(
    (tab: TabItem): void => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      closeMore();
      closeProfile();
      if (tab.id === 'more') {
        openMore();
      } else {
        navigateToBase(tab.route);
      }
    },
    [openMore, closeMore, closeProfile]
  );

  const handleAdd = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    closeMore();
    closeProfile();
    router.push('/(tabs)/bills/add');
  }, [closeMore, closeProfile]);

  const permissions = useAuthStore((s) => s.permissions);
  const features = useSettingsStore((s) => s.features);
  // A tab is shown only when the member may use that feature. Home and More are
  // structural and always shown; Bills and Parking respect the house switch and
  // the member's permission so a revoked feature never appears in the bar.
  const canUse = useCallback(
    (id: string): boolean => {
      if (id === 'dashboard' || id === 'more') return true;
      return hasFeatureAccess(id, features, permissions);
    },
    [features, permissions]
  );
  const canAddBill = canUse('bills');

  const renderTab = (tab: TabItem, badge: number): React.JSX.Element => {
    const active = isActive(tab.id);
    return (
      <TabButton
        key={tab.id}
        active={active}
        badge={badge}
        label={tabLabels[tab.id]}
        onPress={() => handleTab(tab)}
        renderIcon={(color) =>
          tab.id === 'parking' ? (
            <ParkingSignIcon size={ICON_SIZE} color={color} active={active} />
          ) : (
            <Ionicons name={active ? tab.iconActive : tab.icon} size={ICON_SIZE} color={color} />
          )
        }
      />
    );
  };

  const bg = c.background;
  const borderColor = c.border;
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bg, borderTopColor: borderColor, paddingBottom: bottomInset },
      ]}
      testID="bottom-tab-bar"
    >
      {/* Left two tabs */}
      {TABS.slice(0, 2)
        .filter((tab) => canUse(tab.id))
        .map((tab) => renderTab(tab, tab.id === 'bills' ? billBadge : 0))}

      {/* Center + button — only for members who can add a bill; the wrapper
          stays as a spacer either way so the bar keeps its balance. */}
      <View style={styles.centerWrap}>
        {canAddBill && (
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: c.primary },
              pressed && styles.addPressed,
            ]}
            onPress={handleAdd}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.add_expense_btn')}
            accessibilityState={{ disabled: false }}
          >
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      {/* Right two tabs */}
      {TABS.slice(2)
        .filter((tab) => canUse(tab.id))
        .map((tab) =>
          renderTab(tab, tab.id === 'parking' ? parkingBadge : tab.id === 'more' ? moreBadge : 0)
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: ms(10),
    minHeight: sizes.bottomTabBarHeight,
  },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
    width: ms(54),
    height: ms(54),
    borderRadius: ms(27),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ms(8),
    shadowColor: '#3B6FBF',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  addPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
