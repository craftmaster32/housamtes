import React, { useEffect, useMemo } from 'react';
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
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { isEventImminent } from '@utils/events';
import { upcomingEventOccurrences } from '@utils/happeningNow';
import { mf, ms } from '@utils/responsive';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const COMING_UP_LIMIT = 3;

function todayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function localeFor(lang: string): string {
  return lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
}

// A soft pulsing dot — the "this is live right now" cue on happening-now banners.
function LiveDot({ color }: { color: string }): React.JSX.Element {
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

// ── One happening-now banner (live) ───────────────────────────────────────────
function LiveBanner({
  icon,
  accent,
  eyebrow,
  title,
  onPress,
  accessibilityLabel,
}: {
  icon: IoniconName;
  accent: string;
  eyebrow: string;
  title: string;
  onPress: () => void;
  accessibilityLabel: string;
}): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: accent },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.bannerIcon, { backgroundColor: accent + '1F' }]}>
        <Ionicons name={icon} size={17} color={accent} />
      </View>
      <View style={styles.flex1}>
        <View style={styles.eyebrowRow}>
          <LiveDot color={accent} />
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

// ── One coming-up row (compact date chip) ─────────────────────────────────────
function ComingRow({
  icon,
  accent,
  month,
  day,
  eyebrow,
  title,
  onPress,
  accessibilityLabel,
}: {
  icon: IoniconName;
  accent: string;
  month: string;
  day: string;
  eyebrow: string;
  title: string;
  onPress: () => void;
  accessibilityLabel: string;
}): React.JSX.Element {
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: c.surface, borderColor: c.border, borderLeftColor: accent },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.dateChip, { backgroundColor: accent + '1F' }]}>
        <Text style={[styles.dateM, { color: accent }]}>{month}</Text>
        <Text style={[styles.dateN, { color: accent }]}>{day}</Text>
      </View>
      <View style={styles.flex1}>
        <View style={styles.rowEyebrow}>
          <Ionicons name={icon} size={11} color={accent} />
          <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        </View>
        <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={17} color={c.textTertiary} />
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
  eyebrowIcon: IoniconName;
  onPress: () => void;
}

// ── The strip ─────────────────────────────────────────────────────────────────
export function HappeningNow(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const memberName = useMemberName();
  const events = useEventsStore((s) => s.events);
  const activeRun = useGroceryStore((s) => s.activeRun);
  const parkingCurrent = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const today = todayYMD();

  // "Coming up" merges upcoming events with approved, still-upcoming parking
  // reservations, sorted by date then start time, capped so the strip stays short.
  const coming = useMemo<ComingEntry[]>(() => {
    const eventEntries: ComingEntry[] = upcomingEventOccurrences(
      events,
      today,
      COMING_UP_LIMIT
    ).map((e) => ({
      key: `event:${e.id}`,
      icon: 'calendar',
      accent: c.primary,
      date: e.date,
      startTime: e.startTime,
      title: e.title,
      eyebrowIcon: 'calendar-outline',
      onPress: () => router.push('/(tabs)/calendar'),
    }));
    const reservationEntries: ComingEntry[] = reservations
      .filter((r) => r.status === 'approved' && r.date >= today)
      .map((r) => ({
        key: `parking:${r.id}`,
        icon: 'car-sport',
        accent: c.secondaryForeground,
        date: r.date,
        startTime: r.startTime,
        title: t('happening.parking_reserved', { name: memberName(r.requestedBy).split(' ')[0] }),
        eyebrowIcon: 'car-sport-outline' as IoniconName,
        onPress: () => router.push('/(tabs)/parking'),
      }));
    return [...eventEntries, ...reservationEntries]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      })
      .slice(0, COMING_UP_LIMIT);
  }, [events, reservations, today, c.primary, c.secondaryForeground, t, memberName]);

  const hasLive = !!activeRun || !!parkingCurrent;
  if (!hasLive && coming.length === 0) return <></>;

  const nowLabel = t('happening.now').toUpperCase();

  return (
    <View>
      {/* ── Happening now ── */}
      {activeRun && (
        <LiveBanner
          icon="bag-handle"
          accent={c.success}
          eyebrow={nowLabel}
          title={t('happening.shopping_now', { name: activeRun.shopperName.split(' ')[0] })}
          onPress={() => router.push('/(tabs)/grocery')}
          accessibilityLabel={t('happening.shopping_now', {
            name: activeRun.shopperName.split(' ')[0],
          })}
        />
      )}
      {parkingCurrent && (
        <LiveBanner
          icon="car"
          accent={c.primary}
          eyebrow={nowLabel}
          title={t('happening.parking_now', {
            name: memberName(parkingCurrent.occupant).split(' ')[0],
          })}
          onPress={() => router.push('/(tabs)/parking')}
          accessibilityLabel={t('happening.parking_now', {
            name: memberName(parkingCurrent.occupant).split(' ')[0],
          })}
        />
      )}

      {/* ── Coming up ── */}
      {coming.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>
            {t('happening.coming_up')}
          </Text>
          {coming.map((item) => {
            const imminent = isEventImminent({ date: item.date, startTime: item.startTime });
            const d = new Date(`${item.date}T12:00:00`);
            const isToday = item.date === today;
            const dateLabel = isToday
              ? t('common.today')
              : d.toLocaleDateString(localeFor(language), { weekday: 'short' });
            const eyebrow = (item.startTime ? `${dateLabel} · ${item.startTime}` : dateLabel)
              .toString()
              .toUpperCase();
            if (imminent) {
              return (
                <LiveBanner
                  key={item.key}
                  icon={item.icon}
                  accent={item.accent}
                  eyebrow={eyebrow}
                  title={item.title}
                  onPress={item.onPress}
                  accessibilityLabel={`${eyebrow} — ${item.title}`}
                />
              );
            }
            return (
              <ComingRow
                key={item.key}
                icon={item.eyebrowIcon}
                accent={item.accent}
                month={d.toLocaleDateString(localeFor(language), { month: 'short' })}
                day={String(d.getDate())}
                eyebrow={eyebrow}
                title={item.title}
                onPress={item.onPress}
                accessibilityLabel={`${eyebrow} — ${item.title}`}
              />
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  sectionLabel: {
    marginTop: ms(16),
    marginBottom: ms(2),
    fontSize: mf(11),
    ...font.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Live / imminent banner
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

  // Compact coming-up row
  row: {
    marginTop: ms(12),
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(11),
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: ms(14),
    padding: ms(11),
  },
  rowEyebrow: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
  dateChip: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateM: { fontSize: mf(9), ...font.bold, textTransform: 'uppercase', lineHeight: mf(11) },
  dateN: { fontSize: mf(15), ...font.extrabold, lineHeight: mf(17) },
  rowTitle: { fontSize: mf(14), ...font.semibold, marginTop: ms(1) },
});
