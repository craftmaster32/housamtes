import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useLanguageStore } from '@stores/languageStore';
import { useParkingStore } from '@stores/parkingStore';
import { byStartTime, parseDateParts, toDateString, todayString } from '@utils/parkingDates';
import { mf, ms } from '@utils/responsive';
import { statusDotColor } from './reservationStatus';

interface DayTilesProps {
  onDayPress: (date: string) => void;
}

/**
 * The next seven days, each on its own little tear-off calendar page: weekday
 * on a band with two binding holes, the date below, and a dot per reservation.
 * Today's page is blue. Tapping a page opens that day's schedule.
 */
export function DayTiles({ onDayPress }: DayTilesProps): React.JSX.Element {
  const c = useThemedColors();
  const dark = c === darkColors;
  const headingFont = useHeadingFont('semibold');
  const language = useLanguageStore((s) => s.language);
  const reservations = useParkingStore((s) => s.reservations);

  const today = todayString();
  const days = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = toDateString(new Date(y, m - 1, d + i));
      const { dayNum, weekdayShort, weekdayFull, monthAbbr } = parseDateParts(dateStr, language);
      const dots = reservations
        .filter((r) => r.date === dateStr)
        .sort(byStartTime)
        .slice(0, 3);
      return { dateStr, dayNum, weekdayShort, weekdayFull, monthAbbr, isToday: i === 0, dots };
    });
  }, [today, language, reservations]);

  // The weekday band: blue for today; a muted ink band otherwise (a lifted
  // graphite band in dark mode so the white-ish text still reads).
  const bandBg = dark ? c.surfaceSecondary : c.textSecondary;
  const bandText = dark ? c.textPrimary : '#FFFFFF';

  return (
    <View style={styles.row}>
      {days.map((d) => (
        <Pressable
          key={d.dateStr}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: c.surface, borderColor: d.isToday ? c.primary : c.border },
            d.isToday && styles.tileToday,
            pressed && styles.pressed,
          ]}
          onPress={() => onDayPress(d.dateStr)}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${d.weekdayFull} ${d.dayNum} ${d.monthAbbr}`}
        >
          <View style={[styles.band, { backgroundColor: d.isToday ? c.primary : bandBg }]}>
            <View style={[styles.hole, styles.holeStart, { backgroundColor: c.background }]} />
            <View style={[styles.hole, styles.holeEnd, { backgroundColor: c.background }]} />
            <Text
              style={[styles.weekday, { color: d.isToday ? '#FFFFFF' : bandText }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {d.weekdayShort}
            </Text>
          </View>
          <Text style={[styles.num, headingFont, { color: d.isToday ? c.primary : c.textPrimary }]}>
            {d.dayNum}
          </Text>
          <View style={styles.dots}>
            {d.dots.map((r) => (
              <View key={r.id} style={[styles.dot, { backgroundColor: statusDotColor(r, c) }]} />
            ))}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: ms(6), marginTop: ms(22) },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    borderRadius: ms(10),
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: ms(6),
  },
  tileToday: { borderWidth: 2 },
  pressed: { opacity: 0.75 },
  band: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: ms(7),
    paddingBottom: ms(4),
    paddingHorizontal: ms(2),
  },
  hole: {
    position: 'absolute',
    top: ms(2),
    width: ms(4),
    height: ms(4),
    borderRadius: ms(2),
  },
  holeStart: { start: '22%' },
  holeEnd: { end: '22%' },
  weekday: { fontSize: mf(10.5), ...font.extrabold, letterSpacing: 0.3 },
  num: { fontSize: mf(22), lineHeight: mf(34), marginTop: ms(2) },
  dots: { flexDirection: 'row', gap: ms(3), height: ms(6) },
  dot: { width: ms(6), height: ms(6), borderRadius: ms(3) },
});
