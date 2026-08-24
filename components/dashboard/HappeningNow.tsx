import React, { useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useEventsStore } from '@stores/eventsStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useParkingStore } from '@stores/parkingStore';
import { useMemberName } from '@hooks/useMemberName';
import { isEventImminent } from '@utils/events';
import { upcomingEventOccurrences } from '@utils/happeningNow';
import { mf, ms } from '@utils/responsive';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// How many upcoming events/reservations to expand before the 24h filter.
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

interface BannerProps {
  icon: IoniconName;
  accent: string;
  eyebrow: string;
  title: string;
  live: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

// ── One banner ────────────────────────────────────────────────────────────────
// `live` shows the pulsing dot (something happening right now); scheduled items
// due within 24h use the same prominent style without the dot.
function Banner({
  icon,
  accent,
  eyebrow,
  title,
  live,
  onPress,
  accessibilityLabel,
}: BannerProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: accent },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: false }}
    >
      <View style={[styles.bannerIcon, { backgroundColor: accent + '1F' }]}>
        <Ionicons name={icon} size={17} color={accent} />
      </View>
      <View style={styles.flex1}>
        <View style={styles.eyebrowRow}>
          {live && <LiveDot color={accent} />}
          <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>
        <Text style={[styles.bannerTitle, { color: c.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

// A single upcoming entry, from an event or an approved parking reservation.
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
export function HappeningNow(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const memberName = useMemberName();
  const events = useEventsStore((s) => s.events);
  const activeRun = useGroceryStore((s) => s.activeRun);
  const parkingCurrent = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const today = todayYMD();

  const handleCalendarPress = useCallback((): void => {
    router.push('/(tabs)/calendar');
  }, []);

  const handleGroceryPress = useCallback((): void => {
    router.push('/(tabs)/grocery');
  }, []);

  const handleParkingPress = useCallback((): void => {
    router.push('/(tabs)/parking');
  }, []);

  // Upcoming events + approved parking reservations, kept only when they fall
  // within the next 24 hours (or land today), sorted soonest-first.
  const soon = useMemo<ComingEntry[]>(() => {
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
      .filter((r) => r.status === 'approved' && r.date >= today)
      .map((r) => ({
        key: `parking:${r.id}`,
        icon: 'car-sport',
        accent: c.secondaryForeground,
        date: r.date,
        startTime: r.startTime,
        title: t('happening.parking_reserved', { name: memberName(r.requestedBy).split(' ')[0] }),
        onPress: handleParkingPress,
      }));
    return [...eventEntries, ...reservationEntries]
      .filter((item) => isEventImminent({ date: item.date, startTime: item.startTime }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      })
      .slice(0, DISPLAY_LIMIT);
  }, [
    events,
    reservations,
    today,
    c.primary,
    c.secondaryForeground,
    t,
    memberName,
    handleCalendarPress,
    handleParkingPress,
  ]);

  const hasLive = !!activeRun || !!parkingCurrent;
  if (!hasLive && soon.length === 0) return <></>;

  const nowLabel = t('happening.now').toUpperCase();

  return (
    <View>
      {/* ── Happening now (live) ── */}
      {activeRun && (
        <Banner
          icon="bag-handle"
          accent={c.success}
          eyebrow={nowLabel}
          title={t('happening.shopping_now', { name: activeRun.shopperName.split(' ')[0] })}
          live
          onPress={handleGroceryPress}
          accessibilityLabel={t('happening.shopping_now', {
            name: activeRun.shopperName.split(' ')[0],
          })}
        />
      )}
      {parkingCurrent && (
        <Banner
          icon="car"
          accent={c.primary}
          eyebrow={nowLabel}
          title={t('happening.parking_now', {
            name: memberName(parkingCurrent.occupant).split(' ')[0],
          })}
          live
          onPress={handleParkingPress}
          accessibilityLabel={t('happening.parking_now', {
            name: memberName(parkingCurrent.occupant).split(' ')[0],
          })}
        />
      )}

      {/* ── Due within 24h ── */}
      {soon.map((item) => {
        const isToday = item.date === today;
        const dateLabel = isToday ? t('common.today') : t('common.tomorrow');
        const eyebrow = (item.startTime ? `${dateLabel} · ${item.startTime}` : dateLabel)
          .toString()
          .toUpperCase();
        return (
          <Banner
            key={item.key}
            icon={item.icon}
            accent={item.accent}
            eyebrow={eyebrow}
            title={item.title}
            live={false}
            onPress={item.onPress}
            accessibilityLabel={`${eyebrow} — ${item.title}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  banner: {
    marginTop: ms(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(11),
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: ms(16),
    padding: ms(13),
  },
  bannerIcon: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { fontSize: mf(14.5), ...font.semibold, marginTop: ms(2) },

  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  eyebrow: { fontSize: mf(10), ...font.bold, letterSpacing: 0.5, textTransform: 'uppercase' },
  liveDot: { width: ms(7), height: ms(7), borderRadius: ms(4) },
});
