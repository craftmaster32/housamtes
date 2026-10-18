import React, { useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { navigateToBase } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useEventsStore } from '@stores/eventsStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useParkingStore } from '@stores/parkingStore';
import { useMemberName } from '@hooks/useMemberName';
import { isEventImminent } from '@utils/events';
import { upcomingEventOccurrences } from '@utils/happeningNow';
import { UserAvatar } from '@components/shared/UserAvatar';
import { elapsedLabel } from '@components/grocery/ShoppingRunCard';
import { DashboardSectionTitle } from '@components/dashboard/DashboardSectionTitle';
import { mf, ms } from '@utils/responsive';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// How many upcoming events/reservations to expand before the display cap.
const LOOKAHEAD = 5;
// Maximum upcoming entries shown in the strip.
const DISPLAY_LIMIT = 3;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

interface LiveDotProps {
  color: string;
}

// A soft pulsing dot — the "this is live right now" cue on happening-now banners.
function LiveDot({ color }: LiveDotProps): React.JSX.Element {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[styles.liveDot, { backgroundColor: color }, style]} />;
}

interface RowProps {
  /** Leading picture: a housemate's face, or an icon in the entry's colour. */
  leading: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  accessibilityLabel: string;
}

// ── One row ───────────────────────────────────────────────────────────────────
/** One "Right now" row: a face or icon, what's happening, and when. */
function Row({
  leading,
  title,
  subtitle,
  onPress,
  accessibilityLabel,
}: RowProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSecondary }]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: false }}
    >
      <View style={styles.leading}>{leading}</View>
      <View style={styles.flex1}>
        <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: c.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}

// A single upcoming entry, from an event or a pending/approved parking reservation.
interface ComingEntry {
  key: string;
  icon: IoniconName;
  accent: string;
  date: string; // YYYY-MM-DD — resolved occurrence
  startTime?: string;
  title: string;
  onPress: () => void;
}

// ── The strip ─────────────────────────────────────────────────────────────────
/** "Right now": who's out shopping, plus events and parking bookings for today or tomorrow. */
export function HappeningNow(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
  const memberName = useMemberName();
  const events = useEventsStore((s) => s.events);
  const activeRun = useGroceryStore((s) => s.activeRun);
  const reservations = useParkingStore((s) => s.reservations);
  const today = todayYMD();

  const handleCalendarPress = useCallback((): void => {
    navigateToBase('/(tabs)/calendar');
  }, []);

  const handleGroceryPress = useCallback((): void => {
    navigateToBase('/(tabs)/grocery');
  }, []);

  const handleParkingPress = useCallback((): void => {
    navigateToBase('/(tabs)/parking');
  }, []);

  // Upcoming events + pending/approved parking reservations sorted soonest-first,
  // capped at DISPLAY_LIMIT. Elapsed same-day items are excluded when
  // startTime is known; date-only entries for today are kept.
  const soon = useMemo<ComingEntry[]>(() => {
    const now = new Date();

    const eventEntries: ComingEntry[] = upcomingEventOccurrences(events, today, LOOKAHEAD).map(
      (e) => ({
        key: `event:${e.id}`,
        icon: 'calendar',
        accent: c.primary,
        date: e.date,
        startTime: e.startTime,
        title: e.title,
        onPress: handleCalendarPress,
      })
    );
    const reservationEntries: ComingEntry[] = reservations
      .filter((r) => (r.status === 'approved' || r.status === 'pending') && r.date >= today)
      .map((r) => {
        const name = memberName(r.requestedBy).split(' ')[0];
        return {
          key: `parking:${r.id}`,
          icon: 'car-sport',
          accent: r.status === 'pending' ? c.warning : c.secondaryForeground,
          date: r.date,
          startTime: r.startTime,
          title:
            r.status === 'pending'
              ? t('happening.parking_requested', { name })
              : t('happening.parking_reserved', { name }),
          onPress: handleParkingPress,
        };
      });
    return (
      [...eventEntries, ...reservationEntries]
        .filter((item) => {
          // Exclude same-day items whose start time has already passed.
          if (item.date === today && item.startTime) {
            const [hh, mm] = item.startTime.split(':').map(Number);
            const itemTime = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              hh,
              mm,
              0,
              0
            );
            return itemTime > now;
          }
          return true;
        })
        // Only surface items that are happening today or within the next 24h.
        .filter((item) => isEventImminent({ date: item.date, startTime: item.startTime }))
        .sort((a, b) => {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          return (a.startTime ?? '').localeCompare(b.startTime ?? '');
        })
        .slice(0, DISPLAY_LIMIT)
    );
  }, [
    events,
    reservations,
    today,
    c.primary,
    c.secondaryForeground,
    c.warning,
    t,
    memberName,
    handleCalendarPress,
    handleParkingPress,
  ]);

  const renderSoonItem = useCallback(
    ({ item }: { item: ComingEntry }): React.JSX.Element => {
      // Everything here is within 24h (today or tomorrow).
      const isToday = item.date === today;
      const dayLabel = isToday ? t('common.today') : t('common.tomorrow');
      const when = item.startTime ? `${dayLabel} · ${item.startTime}` : dayLabel;
      return (
        <Row
          leading={<Ionicons name={item.icon} size={22} color={item.accent} />}
          title={item.title}
          subtitle={when}
          onPress={item.onPress}
          accessibilityLabel={`${when} — ${item.title}`}
        />
      );
    },
    [today, t]
  );

  const hasLive = !!activeRun;
  if (!hasLive && soon.length === 0) return <></>;

  const shopperFirstName = activeRun ? activeRun.shopperName.split(' ')[0] : '';
  const separator = (): React.JSX.Element => (
    <View style={[styles.separator, { backgroundColor: c.border }]} />
  );

  return (
    <View>
      <DashboardSectionTitle title={t('dashboard.right_now')} />
      <View
        style={[
          styles.group,
          { backgroundColor: c.surface, borderColor: isDark ? c.border : 'transparent' },
        ]}
      >
        {/* ── Live: someone is out shopping ── */}
        {activeRun && (
          <Row
            leading={
              <View>
                <UserAvatar userId={activeRun.shopperId} size={ms(32)} />
                <View style={[styles.liveDotRing, { backgroundColor: c.surface }]}>
                  <LiveDot color={c.success} />
                </View>
              </View>
            }
            title={t('happening.shopping_now', { name: shopperFirstName })}
            subtitle={elapsedLabel(activeRun.startedAt, t)}
            onPress={handleGroceryPress}
            accessibilityLabel={t('happening.shopping_now', { name: shopperFirstName })}
          />
        )}
        {/* Parking "now" is intentionally not surfaced here — the parking row under
            "Around the house" already shows live parking status. */}
        {activeRun && soon.length > 0 && separator()}

        {/* ── Coming up today or tomorrow ── */}
        <FlatList
          data={soon}
          keyExtractor={(item) => item.key}
          scrollEnabled={false}
          renderItem={renderSoonItem}
          ItemSeparatorComponent={separator}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  // One soft card holds every row, separated by hairlines — like a native list.
  group: { borderRadius: ms(22), borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    minHeight: ms(62),
    paddingVertical: ms(12),
    paddingStart: ms(16),
    paddingEnd: ms(14),
  },
  leading: { width: ms(32), alignItems: 'center' },
  rowTitle: { fontSize: mf(16), ...font.semibold, lineHeight: mf(21) },
  rowSub: { fontSize: mf(14), ...font.regular, marginTop: ms(2) },
  separator: { height: StyleSheet.hairlineWidth, marginStart: ms(60) },
  liveDotRing: {
    position: 'absolute',
    bottom: ms(-2),
    end: ms(-2),
    width: ms(13),
    height: ms(13),
    borderRadius: ms(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: ms(9), height: ms(9), borderRadius: ms(5) },
});
