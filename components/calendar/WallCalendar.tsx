import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { PenCircle } from '@components/shared/PenCircle';
import { MONTH_KEYS, WEEKDAY_KEYS, toYMD } from '@components/calendar/calendarMeta';
import { mf, ms } from '@utils/responsive';

// The calendar is a paper page hanging on the wall: light inks in both themes.
const P = lightColors;
const PAGE = '#FFFDF6';
const RULE = 'rgba(107,98,80,0.18)';
const HIGHLIGHT = 'rgba(252,226,120,0.75)';
const RINGS = 9;

export interface DayMark {
  title: string;
  color: string;
}

interface WallCalendarProps {
  year: number;
  month: number;
  selected: string;
  today: string;
  marks: Record<string, DayMark[]>;
  rtl: boolean;
  onSelect: (ymd: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

function buildGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Spiral binding along the top of the page. */
function Binding(): React.JSX.Element {
  return (
    <View style={styles.binding} pointerEvents="none">
      <Svg width="100%" height={ms(22)} preserveAspectRatio="none" viewBox="0 0 100 22">
        <Rect x={0} y={9} width={100} height={6} fill="#3A3833" />
      </Svg>
      <View style={styles.rings}>
        {Array.from({ length: RINGS }, (_, i) => (
          <Svg key={i} width={ms(10)} height={ms(24)} viewBox="0 0 10 24">
            <Path
              d="M5 2 C9 2 9 12 5 18 C1 12 1 2 5 2"
              stroke="#8D8A84"
              strokeWidth={2}
              fill="none"
            />
          </Svg>
        ))}
      </View>
    </View>
  );
}

/**
 * The month as a wall calendar: spiral binding, the month in Fraunces, ruled
 * day boxes with entries written in colour, today circled in pen and the chosen
 * day swiped with a highlighter.
 */
function WallCalendarComponent({
  year,
  month,
  selected,
  today,
  marks,
  rtl,
  onSelect,
  onPrev,
  onNext,
}: WallCalendarProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  return (
    <View style={styles.wrap}>
      <View style={styles.page}>
        <View style={styles.head}>
          <Pressable
            style={styles.nav}
            onPress={onPrev}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.prev_month')}
          >
            <Ionicons
              name={rtl ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color={P.paperInk}
            />
          </Pressable>
          <View style={styles.headCopy} accessibilityRole="header">
            <Text style={[styles.month, heading]}>{t(`calendar.${MONTH_KEYS[month]}`)}</Text>
            <Text style={[styles.year, hand]}>{year}</Text>
          </View>
          <Pressable
            style={styles.nav}
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.next_month')}
          >
            <Ionicons
              name={rtl ? 'chevron-back' : 'chevron-forward'}
              size={20}
              color={P.paperInk}
            />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAY_KEYS.map((key) => (
            <Text key={key} style={styles.weekDay}>
              {t(`calendar.${key}`)}
            </Text>
          ))}
        </View>

        {[0, 1, 2, 3, 4, 5].map((row) => (
          <View key={row} style={styles.row}>
            {grid.slice(row * 7, row * 7 + 7).map((day) => {
              const ymd = toYMD(day);
              const dayMarks = marks[ymd] ?? [];
              const inMonth = day.getMonth() === month;
              const isToday = ymd === today;
              const isSelected = ymd === selected;
              return (
                <Pressable
                  key={ymd}
                  style={[styles.cell, isSelected && styles.cellOn]}
                  onPress={() => onSelect(ymd)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${day.toLocaleDateString(i18n.language, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}${dayMarks.length ? `, ${dayMarks.length}` : ''}`}
                >
                  <View style={styles.numWrap}>
                    {isToday && (
                      <PenCircle color={P.negative} style={styles.todayRing} strokeWidth={2} />
                    )}
                    <Text
                      style={[styles.num, !inMonth && styles.numFaint, isToday && styles.numToday]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                  {dayMarks.slice(0, 2).map((m, i) => (
                    <Text
                      key={i}
                      style={[styles.mark, { color: m.color, borderStartColor: m.color }]}
                      numberOfLines={1}
                    >
                      {m.title}
                    </Text>
                  ))}
                  {dayMarks.length > 2 && <Text style={styles.more}>+{dayMarks.length - 2}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Binding />
    </View>
  );
}

export const WallCalendar = React.memo(WallCalendarComponent);

const styles = StyleSheet.create({
  wrap: { paddingTop: ms(12) },
  binding: { position: 'absolute', top: 0, left: ms(10), right: ms(10) },
  rings: {
    position: 'absolute',
    top: -ms(1),
    left: ms(14),
    right: ms(14),
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  page: {
    backgroundColor: PAGE,
    borderRadius: ms(6),
    paddingTop: ms(18),
    paddingHorizontal: ms(6),
    paddingBottom: ms(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(3) },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(4),
    marginBottom: ms(6),
  },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headCopy: { flexDirection: 'row', alignItems: 'baseline', gap: ms(8) },
  month: { fontSize: mf(26), lineHeight: mf(34), color: P.paperInk, letterSpacing: -0.4 },
  year: { fontSize: mf(22), color: P.paperMuted },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(107,98,80,0.35)',
    paddingBottom: ms(4),
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: mf(11.5),
    ...font.bold,
    color: P.paperMuted,
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: RULE },
  cell: {
    flex: 1,
    minHeight: ms(58),
    paddingTop: ms(4),
    paddingHorizontal: ms(2),
    alignItems: 'stretch',
  },
  cellOn: { backgroundColor: HIGHLIGHT, borderRadius: ms(3) },
  numWrap: { alignSelf: 'center', paddingHorizontal: ms(5), marginBottom: ms(2) },
  todayRing: {
    position: 'absolute',
    top: -ms(3),
    bottom: -ms(3),
    left: -ms(2),
    right: -ms(2),
    transform: [{ rotate: '-6deg' }],
  },
  num: { fontSize: mf(14), ...font.semibold, color: P.paperInk, textAlign: 'center' },
  numFaint: { color: 'rgba(107,98,80,0.4)' },
  numToday: { color: P.negative, ...font.bold },
  mark: {
    fontSize: mf(9.5),
    lineHeight: mf(13),
    ...font.semibold,
    borderStartWidth: 2,
    paddingStart: ms(2),
    marginTop: ms(1),
  },
  more: { fontSize: mf(9.5), ...font.bold, color: P.paperMuted, textAlign: 'center' },
});
