import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { navigateToBase } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { useGroceryStore } from '@stores/groceryStore';
import { useTasksStore } from '@stores/tasksStore';
import { useVotingStore } from '@stores/votingStore';
import { useParkingStore, findBlockedReservation } from '@stores/parkingStore';
import { useAppliancesStore, type ApplianceKind } from '@stores/appliancesStore';
import { MACHINE_META, formatRemaining } from '@components/machines/meta';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { resolveName } from '@utils/housemates';
import { getErrorMessage } from '@utils/errors';
import { toneColors } from '@utils/groceryCategory';
import { Alert } from '@lib/alert';
import { useDashboardCardsStore, type DashboardCardKey } from '@stores/dashboardCardsStore';
import { DashboardSectionTitle } from '@components/dashboard/DashboardSectionTitle';
import { DashboardCardsSheet, CARD_ICON } from '@components/dashboard/DashboardCardsSheet';
import { makeStyles, type DashboardListStyles } from './DashboardCarousel.styles';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Styles = DashboardListStyles;

// ── Shared row ────────────────────────────────────────────────────────────────
interface RowProps {
  styles: Styles;
  icon: IoniconName;
  iconColor: string;
  title: string;
  subtitle?: string;
  subtitleAlert?: boolean;
  /** Replaces the chevron, e.g. a "Take it" pill or a countdown. */
  trailing?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
}

function Row({
  styles,
  icon,
  iconColor,
  title,
  subtitle,
  subtitleAlert = false,
  trailing,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: RowProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <View style={styles.leading}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.sub, subtitleAlert && styles.subAlert]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing ?? <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />}
    </Pressable>
  );
}

// Each kind of thing keeps its own colour, from the same soft palette as Grocery.
function useRowTones(): Record<'green' | 'amber' | 'blue' | 'violet', string> {
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
  return {
    green: toneColors('green', isDark).fg,
    amber: toneColors('amber', isDark).fg,
    blue: toneColors('blue', isDark).fg,
    violet: toneColors('violet', isDark).fg,
  };
}

// ── Individual rows ───────────────────────────────────────────────────────────
function GroceriesRow({ styles, c }: { styles: Styles; c: ColorTokens }): React.JSX.Element {
  const { t } = useTranslation();
  const tones = useRowTones();
  const items = useGroceryStore((s) => s.items);
  const toggleItem = useGroceryStore((s) => s.toggleItem);
  const shared = items.filter((i) => !i.isPersonal && !i.isDraft);
  const toBuy = shared.filter((i) => !i.isChecked).length;
  const preview = shared.slice(0, 3);
  const onToggle = useCallback(
    (id: string): void => {
      toggleItem(id).catch(() => {});
    },
    [toggleItem]
  );
  // The row opens the list; the preview items below tick off in place, so this
  // stays a working mini-list rather than a plain link.
  return (
    <View>
      <Row
        styles={styles}
        icon="cart-outline"
        iconColor={tones.green}
        title={
          toBuy > 0 ? t('grocery.header_to_grab', { count: toBuy }) : t('dashboard.grocery_list')
        }
        subtitle={preview.length === 0 ? t('dashboard.grocery_empty') : undefined}
        onPress={() => navigateToBase('/(tabs)/grocery')}
        accessibilityLabel={t('dashboard.grocery_list')}
      />
      {preview.length > 0 && (
        <View style={styles.groceryItems}>
          {preview.map((item) => (
            <Pressable
              key={item.id}
              style={styles.groceryRow}
              onPress={() => onToggle(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.isChecked }}
              accessibilityLabel={item.name}
            >
              <View
                style={[
                  styles.groceryBox,
                  item.isChecked
                    ? { backgroundColor: c.positive, borderColor: c.positive }
                    : { borderColor: c.border },
                ]}
              >
                {item.isChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text
                style={[
                  styles.groceryName,
                  { color: item.isChecked ? c.textTertiary : c.textPrimary },
                  item.isChecked && styles.groceryDone,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function ChoresRow({ styles }: { styles: Styles }): React.JSX.Element {
  const { t } = useTranslation();
  const tones = useRowTones();
  const tasks = useTasksStore((s) => s.tasks);
  const total = tasks.length;
  const done = tasks.filter((tk) => tk.isComplete).length;
  const next = tasks.find((tk) => !tk.isComplete);
  return (
    <Row
      styles={styles}
      icon={CARD_ICON.chores}
      iconColor={tones.amber}
      title={next ? t('dashboard.chore_next', { name: next.title }) : t('dashboard.chores_smashed')}
      subtitle={total > 0 ? t('dashboard.x_of_y_done', { done, total }) : undefined}
      onPress={() => navigateToBase('/(tabs)/tasks')}
      accessibilityLabel={t('dashboard.x_of_y_done', { done, total })}
    />
  );
}

function VotesRow({ styles }: { styles: Styles }): React.JSX.Element {
  const { t } = useTranslation();
  const tones = useRowTones();
  const proposals = useVotingStore((s) => s.proposals);
  const open = proposals.filter((p) => p.isOpen);
  const next = open[0];
  return (
    <Row
      styles={styles}
      icon={CARD_ICON.votes}
      iconColor={tones.violet}
      title={next ? next.title : t('dashboard.votes_none')}
      subtitle={t('dashboard.votes_open', { count: open.length })}
      onPress={() => navigateToBase('/(tabs)/voting')}
      accessibilityLabel={t('dashboard.votes_label')}
    />
  );
}

interface ParkingCardProps {
  styles: Styles;
}

export function ParkingCard({ styles }: ParkingCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const tones = useRowTones();
  const current = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const claimParking = useParkingStore((s) => s.claim);
  const releaseParking = useParkingStore((s) => s.release);
  const housemates = useHousematesStore((s) => s.housemates);
  const myId = useAuthStore((s) => s.profile?.id);
  const myName = useAuthStore((s) => s.profile?.name);
  const houseId = useAuthStore((s) => s.houseId);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const isFree = !current;
  // Re-check every minute while the spot is taken, so a reserved slot that
  // starts while the car is still parked shows up without a reload.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!current) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return (): void => clearInterval(id);
  }, [current]);
  const blocked = useMemo(
    () => findBlockedReservation(current, reservations ?? [], new Date(nowMs)),
    [current, reservations, nowMs]
  );
  const blockedHolder = blocked
    ? resolveName(blocked.requestedBy, housemates, t('common.unknown')).split(' ')[0]
    : '';
  const occupant = resolveName(current?.occupant ?? '', housemates, '').split(' ')[0];
  // Tapping the row is a quick catch/release toggle — claim the free spot,
  // release your own, or (when a housemate holds it) confirm before freeing it,
  // mirroring the parking page's gate. The full page is reached from the bottom
  // bar's car icon.
  const handleParkingPress = useCallback((): void => {
    // Immediate tactile ack so the toggle feels instant, not delayed.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const uid = myId ?? '';
    const uname = myName ?? '';
    const hId = houseId ?? '';
    const cur = useParkingStore.getState().current;

    if (cur && cur.occupant !== uid) {
      const occupantName = resolveName(cur.occupant, housemates, t('common.unknown'));
      const pinnedId = cur.id;
      const doRelease = (): void => {
        if (useParkingStore.getState().current?.id !== pinnedId) {
          Alert.alert(t('parking.could_not_free'), t('parking.spot_changed'));
          return;
        }
        if (busyRef.current) return;
        busyRef.current = true;
        setIsBusy(true);
        releaseParking(hId, uname)
          .catch(() => Alert.alert(t('parking.could_not_free'), t('parking.failed_release')))
          .finally(() => {
            busyRef.current = false;
            setIsBusy(false);
          });
      };
      if (Platform.OS === 'web') {
        if (window.confirm(t('parking.evict_confirm', { name: occupantName }))) doRelease();
      } else {
        Alert.alert(
          t('parking.kick_out_title', { name: occupantName }),
          t('parking.kick_out_body'),
          [
            { text: t('parking.leave_it'), style: 'cancel' },
            { text: t('parking.free_it_anyway'), style: 'destructive', onPress: doRelease },
          ]
        );
      }
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setIsBusy(true);
    const done = (): void => {
      busyRef.current = false;
      setIsBusy(false);
    };
    if (cur && cur.occupant === uid) {
      releaseParking(hId, uname)
        .catch((err) =>
          Alert.alert(t('parking.title'), getErrorMessage(err, t('parking.failed_release')))
        )
        .finally(done);
    } else {
      claimParking(uid, uname, hId)
        .catch((err) =>
          Alert.alert(t('parking.title'), getErrorMessage(err, t('parking.failed_claim')))
        )
        .finally(done);
    }
  }, [myId, myName, houseId, housemates, claimParking, releaseParking, t]);
  const isMine = !!current && current.occupant === myId;
  const isHousemate = !!current && current.occupant !== myId;
  const parkingA11yLabel = isMine
    ? t('parking.a11y_release', 'Release parking spot')
    : isHousemate
      ? t('parking.a11y_release_housemate', "Free housemate's parking spot")
      : t('parking.a11y_claim', 'Claim parking spot');
  const parkingA11yHint = isHousemate
    ? t('parking.a11y_hint_housemate', "Frees the housemate's reservation")
    : t('parking.a11y_hint', 'Toggles your parking reservation');

  const title = isFree
    ? t('dashboard.parking_free_now')
    : isMine
      ? t('dashboard.parking_yours')
      : t('dashboard.parking_has_spot', { name: occupant || t('common.unknown') });
  // Someone's reserved slot has started while this car is still parked.
  const subtitle = blocked
    ? isMine
      ? t('dashboard.parking_blocked_move', { name: blockedHolder })
      : t('dashboard.parking_blocked_other', { name: blockedHolder })
    : isFree
      ? t('dashboard.parking_free_sub')
      : undefined;
  const pillLabel = isFree
    ? t('dashboard.parking_take')
    : isMine
      ? t('dashboard.parking_free_it')
      : null;

  return (
    <Row
      styles={styles}
      icon={CARD_ICON.parking}
      iconColor={tones.blue}
      title={title}
      subtitle={subtitle}
      subtitleAlert={!!blocked}
      trailing={
        pillLabel ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{pillLabel}</Text>
          </View>
        ) : undefined
      }
      onPress={handleParkingPress}
      disabled={isBusy}
      accessibilityLabel={parkingA11yLabel}
      accessibilityHint={parkingA11yHint}
    />
  );
}

interface ApplianceRowProps {
  styles: Styles;
  kind: ApplianceKind;
}

function ApplianceRow({ styles, kind }: ApplianceRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const session = useAppliancesStore((s) => s.sessions[kind]);
  const housemates = useHousematesStore((s) => s.housemates);
  const meta = MACHINE_META[kind];
  const [nowMs, setNowMs] = useState(() => Date.now());
  // Tick the countdown only while this machine is actually running.
  useEffect(() => {
    if (!session) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return (): void => clearInterval(id);
  }, [session]);

  const left = session ? Math.max(0, new Date(session.endsAt).getTime() - nowMs) : 0;
  const running = session !== null && left > 0;
  const who = session ? resolveName(session.startedBy, housemates, t('common.unknown')) : '';

  return (
    <Row
      styles={styles}
      icon={meta.icon}
      iconColor={meta.color}
      title={t(meta.labelKey)}
      subtitle={
        !session
          ? t('machines.tap_to_start')
          : running
            ? t('machines.in_use_by', { name: who })
            : t('machines.ready_to_unload')
      }
      trailing={
        <Text style={styles.trailingText}>
          {!session ? t('machines.free') : running ? formatRemaining(left) : t('machines.finished')}
        </Text>
      }
      onPress={() => navigateToBase('/(tabs)/machines')}
      accessibilityLabel={t(meta.labelKey)}
    />
  );
}

function renderRow(key: DashboardCardKey, styles: Styles, c: ColorTokens): React.JSX.Element {
  switch (key) {
    case 'groceries':
      return <GroceriesRow styles={styles} c={c} />;
    case 'chores':
      return <ChoresRow styles={styles} />;
    case 'votes':
      return <VotesRow styles={styles} />;
    case 'parking':
      return <ParkingCard styles={styles} />;
    case 'washer':
    case 'dryer':
    case 'dishwasher':
      return <ApplianceRow styles={styles} kind={key} />;
  }
}

/** Order rows for display: the pinned one (if any) leads, the rest keep their order. */
export function orderDashboardRows(
  enabled: DashboardCardKey[],
  pinned: DashboardCardKey | null
): DashboardCardKey[] {
  if (!pinned || !enabled.includes(pinned)) return enabled;
  return [pinned, ...enabled.filter((k) => k !== pinned)];
}

// ── "Around the house" ────────────────────────────────────────────────────────
export function DashboardCarousel(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
  const styles = useMemo(() => makeStyles(c, isDark), [c, isDark]);
  const enabled = useDashboardCardsStore((s) => s.enabled);
  const pinned = useDashboardCardsStore((s) => s.pinned);
  const hydrate = useDashboardCardsStore((s) => s.hydrate);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    hydrate().catch(() => {});
  }, [hydrate]);

  const rows = orderDashboardRows(enabled, pinned);
  const openManage = useCallback((): void => setManageOpen(true), []);
  const closeManage = useCallback((): void => setManageOpen(false), []);

  return (
    <View>
      <DashboardSectionTitle
        title={t('dashboard.around_the_house')}
        right={
          <Pressable
            style={styles.editBtn}
            onPress={openManage}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.manage_cards')}
          >
            <Text style={styles.editText}>{t('dashboard.edit_cards')}</Text>
          </Pressable>
        }
      />

      <View style={styles.group}>
        {rows.length === 0 ? (
          <Pressable
            style={styles.empty}
            onPress={openManage}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.add_cards_prompt')}
          >
            <Ionicons name="add-circle-outline" size={22} color={c.textSecondary} />
            <Text style={styles.emptyText}>{t('dashboard.add_cards_prompt')}</Text>
          </Pressable>
        ) : (
          rows.map((key, i) => (
            <View key={key}>
              {i > 0 && <View style={styles.separator} />}
              {renderRow(key, styles, c)}
            </View>
          ))
        )}
      </View>

      <DashboardCardsSheet visible={manageOpen} onClose={closeManage} />
    </View>
  );
}
