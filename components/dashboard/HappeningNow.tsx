import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Pressable, FlatList, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { navigateToBase } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { useThemedColors, lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useEventsStore } from '@stores/eventsStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useParkingStore } from '@stores/parkingStore';
import { useMemberName } from '@hooks/useMemberName';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useReduceMotion } from '@hooks/useReduceMotion';
import { isEventImminent } from '@utils/events';
import { upcomingEventOccurrences } from '@utils/happeningNow';
import { mf, ms } from '@utils/responsive';

// How many upcoming events/reservations to expand before the display cap.
const LOOKAHEAD = 5;
// Maximum upcoming entries shown in the strip.
const DISPLAY_LIMIT = 3;
// Amber dark enough for white writing on the stub.
const PENDING_INK = '#A0711A';
// The day and time are printed in white on the coloured stub.
const STUB_INK = '#FFFFFF';

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
    if (reduceMotion) {
      // Stopped mid-pulse? Settle back to a fully visible dot.
      pulse.setValue(1);
      return;
    }
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
  live?: boolean;
  /** Degrees; neighbours lean opposite ways so the row looks hand-placed. */
  tilt?: number;
  onPress: () => void;
  accessibilityLabel: string;
}

const PERFORATION = Array.from({ length: 6 });

// ── One ticket ────────────────────────────────────────────────────────────────
// A white paper ticket with its stub printed in colour (blue for plans, amber
// for a parking request, green for live): the day handwritten and the time in
// the serif, in white on the stub; a dashed tear with punched notches; then
// what it is. White so it never blends into the cream money page below, and
// paper, so it stays light in dark mode. Several sit side by side in one row
// so plans never push the money card and dashboard cards off the first screen.
function Ticket({
  accent,
  day,
  time,
  title,
  live = false,
  tilt = 0,
  onPress,
  accessibilityLabel,
}: TicketProps): React.JSX.Element {
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ticket,
        { backgroundColor: c.receipt, transform: [{ rotate: `${tilt}deg` }] },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: false }}
    >
      <View style={[styles.stub, { backgroundColor: accent }]}>
        <View style={styles.dayRow}>
          {live && <LiveDot color={STUB_INK} />}
          <Text style={[styles.day, hand, { color: STUB_INK }]} numberOfLines={1}>
            {day}
          </Text>
        </View>
        {!!time && (
          <Text style={[styles.time, headingFont, { color: STUB_INK }]} numberOfLines={1}>
            {time}
          </Text>
        )}
      </View>
      {/* The tear: punched notches top and bottom, dashes between — drawn as
          Views since iOS can't dash a single border side. */}
      <View style={styles.tear} pointerEvents="none">
        <View style={[styles.notch, styles.notchTop, { backgroundColor: c.background }]} />
        {PERFORATION.map((_, i) => (
          <View key={i} style={[styles.dash, { backgroundColor: 'rgba(34,32,29,0.22)' }]} />
        ))}
        <View style={[styles.notch, styles.notchBottom, { backgroundColor: c.background }]} />
      </View>
      <Text style={[styles.title, { color: c.receiptInk }]} numberOfLines={1}>
        {title}
      </Text>
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
  onPress: () => void;
}

// ── The strip ─────────────────────────────────────────────────────────────────
export function HappeningNow(): React.JSX.Element {
  const { t } = useTranslation();
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
        accent: lightColors.primary,
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
          accent: r.status === 'pending' ? PENDING_INK : lightColors.secondaryForeground,
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
  }, [events, reservations, today, t, memberName, handleCalendarPress, handleParkingPress]);

  const renderSoonItem = useCallback(
    ({ item, index }: { item: ComingEntry; index: number }): React.JSX.Element => {
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
          tilt={index % 2 === 0 ? -1 : 1.2}
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
    <View style={styles.wrap}>
      {/* ── Happening now (live) ── */}
      {activeRun && (
        <Ticket
          accent={lightColors.success}
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

      {/* ── Upcoming: today's and tomorrow's plans, side by side ── */}
      <FlatList
        horizontal
        data={soon}
        keyExtractor={(item) => item.key}
        renderItem={renderSoonItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      />
    </View>
  );
}

const NOTCH = ms(14);

const styles = StyleSheet.create({
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  wrap: { marginTop: ms(12), gap: ms(8) },
  // Room above and below for the tilt and the shadow.
  row: { gap: ms(10), paddingVertical: ms(6), paddingHorizontal: ms(2) },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: ms(8),
    minHeight: ms(58),
    maxWidth: ms(260),
    paddingEnd: ms(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(4) },
    shadowOpacity: 0.1,
    shadowRadius: ms(8),
    elevation: 2,
  },
  stub: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(12),
    paddingVertical: ms(6),
    borderTopStartRadius: ms(8),
    borderBottomStartRadius: ms(8),
  },
  tear: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: NOTCH / 2 + ms(3),
    marginEnd: ms(12),
  },
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  dash: { width: 2, height: ms(4), borderRadius: 1 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  day: { fontSize: mf(18), lineHeight: mf(20) },
  time: { fontSize: mf(19), lineHeight: mf(23), letterSpacing: -0.3 },
  title: { flexShrink: 1, fontSize: mf(14.5), ...font.bold },
  liveDot: { width: ms(7), height: ms(7), borderRadius: ms(4) },
});
