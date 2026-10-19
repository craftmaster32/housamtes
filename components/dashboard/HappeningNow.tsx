import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Pressable, FlatList, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { navigateToBase } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useEventsStore } from '@stores/eventsStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useParkingStore } from '@stores/parkingStore';
import { useMemberName } from '@hooks/useMemberName';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { isEventImminent } from '@utils/events';
import { upcomingEventOccurrences } from '@utils/happeningNow';
import { mf, ms } from '@utils/responsive';

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

// A soft pulsing dot — the "this is live right now" cue. RN Animated, not
// reanimated, so it also pulses on the web build.
function LiveDot({ color }: LiveDotProps): React.JSX.Element {
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return (): void => loop.stop();
  }, [pulse, reduceMotion]);
  return <Animated.View style={[styles.liveDot, { backgroundColor: color, opacity: pulse }]} />;
}

interface TicketProps {
  accent: string;
  /** Small line on the stub: "Today", "Tomorrow" or "Now". */
  day: string;
  /** Big line on the stub, e.g. "20:00". Omitted for all-day items. */
  time?: string;
  title: string;
  detail?: string;
  live?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

const PERFORATION = Array.from({ length: 7 });

// ── One ticket ────────────────────────────────────────────────────────────────
// Each plan is a ticket: when it happens sits on a torn-off stub, what it is
// on the main part. Two notches cut from the page colour mark the tear line.
function Ticket({
  accent,
  day,
  time,
  title,
  detail,
  live = false,
  onPress,
  accessibilityLabel,
}: TicketProps): React.JSX.Element {
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ticket,
        { backgroundColor: c.surface },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: false }}
    >
      <View style={styles.stub}>
        <View style={styles.dayRow}>
          {live && <LiveDot color={accent} />}
          <Text style={[styles.day, { color: accent }]} numberOfLines={1}>
            {day}
          </Text>
        </View>
        {!!time && (
          <Text
            style={[styles.time, headingFont, { color: c.textPrimary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {time}
          </Text>
        )}
      </View>
      <View style={styles.tear} pointerEvents="none">
        <View style={[styles.notch, styles.notchTop, { backgroundColor: c.background }]} />
        {PERFORATION.map((_, i) => (
          <View key={i} style={[styles.dash, { backgroundColor: c.border }]} />
        ))}
        <View style={[styles.notch, styles.notchBottom, { backgroundColor: c.background }]} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
        {!!detail && (
          <Text style={[styles.detail, { color: c.textSecondary }]} numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// A single upcoming entry, from an event or a pending/approved parking reservation.
interface ComingEntry {
  key: string;
  accent: string;
  date: string; // YYYY-MM-DD — resolved occurrence
  startTime?: string;
  title: string;
  detail?: string;
  onPress: () => void;
}

// ── The strip ─────────────────────────────────────────────────────────────────
export function HappeningNow(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
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
        accent: c.primary,
        date: e.date,
        startTime: e.startTime,
        title: e.title,
        detail: e.notes,
        onPress: handleCalendarPress,
      })
    );
    const reservationEntries: ComingEntry[] = reservations
      .filter((r) => (r.status === 'approved' || r.status === 'pending') && r.date >= today)
      .map((r) => {
        const name = memberName(r.requestedBy).split(' ')[0];
        return {
          key: `parking:${r.id}`,
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
      // Everything here is within 24h, so the stub only ever says today or tomorrow.
      const isToday = item.date === today;
      const dayLabel = isToday ? t('common.today') : t('common.tomorrow');
      const when = item.startTime ? `${dayLabel} · ${item.startTime}` : dayLabel;
      return (
        <Ticket
          accent={item.accent}
          day={dayLabel}
          time={item.startTime}
          title={item.title}
          detail={item.detail}
          onPress={item.onPress}
          accessibilityLabel={`${when} — ${item.title}`}
        />
      );
    },
    [today, t]
  );

  const hasLive = !!activeRun;
  if (!hasLive && soon.length === 0) return <></>;

  const nowLabel = t('happening.now');

  return (
    <View>
      {/* ── Happening now (live) ── */}
      {activeRun && (
        <Ticket
          accent={c.success}
          day={nowLabel}
          title={t('happening.shopping_now', { name: activeRun.shopperName.split(' ')[0] })}
          live
          onPress={handleGroceryPress}
          accessibilityLabel={t('happening.shopping_now', {
            name: activeRun.shopperName.split(' ')[0],
          })}
        />
      )}
      {/* Parking "now" is intentionally not surfaced here — the dashboard parking
          card already shows live parking status. Only the grocery run stays live. */}

      {/* ── Upcoming: today's and tomorrow's plans, one ticket each ── */}
      <FlatList
        data={soon}
        keyExtractor={(item) => item.key}
        scrollEnabled={false}
        renderItem={renderSoonItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  ticket: {
    marginTop: ms(10),
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: ms(18),
    minHeight: ms(72),
  },
  stub: {
    width: ms(84),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ms(12),
    paddingHorizontal: ms(6),
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
  day: { fontSize: mf(12.5), ...font.extrabold },
  time: { fontSize: mf(24), lineHeight: mf(28), letterSpacing: -0.6, marginTop: ms(1) },
  // The tear line: dashes between two half-circle notches.
  tear: {
    width: ms(2),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ms(12),
  },
  dash: { width: ms(2), height: ms(4), borderRadius: ms(1) },
  notch: {
    position: 'absolute',
    left: -ms(7),
    width: ms(16),
    height: ms(16),
    borderRadius: ms(8),
  },
  notchTop: { top: -ms(8) },
  notchBottom: { bottom: -ms(8) },
  body: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: ms(13),
    paddingHorizontal: ms(16),
  },
  title: { fontSize: mf(16), ...font.bold, lineHeight: mf(21) },
  detail: { fontSize: mf(13.5), ...font.medium, marginTop: ms(2) },
  liveDot: { width: ms(7), height: ms(7), borderRadius: ms(4) },
});
