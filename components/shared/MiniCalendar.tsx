import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useLanguageStore } from '@stores/languageStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

function buildRows(year: number, month: number): Array<Array<string | null>> {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export interface CalendarEvent {
  date: string;   // YYYY-MM-DD
  title: string;
}

interface MiniCalendarProps {
  events: CalendarEvent[];
  selectedDate: string;  // YYYY-MM-DD or empty
  onSelectDate: (date: string) => void;
}

export function MiniCalendar({ events, selectedDate, onSelectDate }: MiniCalendarProps): React.JSX.Element {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const language = useLanguageStore((s) => s.language);

  const monthName = useMemo(
    () => new Intl.DateTimeFormat(language, { month: 'long' }).format(new Date(viewYear, viewMonth, 1)),
    [language, viewYear, viewMonth]
  );

  const dayHeaders = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(language, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + i))
    ),
    [language]
  );

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Group events by date for fast lookup
  const eventsByDate = new Map<string, string[]>();
  for (const e of events) {
    if (!eventsByDate.has(e.date)) eventsByDate.set(e.date, []);
    eventsByDate.get(e.date)!.push(e.title);
  }

  const rows = buildRows(viewYear, viewMonth);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>{monthName} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.row}>
        {dayHeaders.map((d, i) => (
          <View key={i} style={styles.headerCell}>
            <Text style={styles.dayHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Week rows */}
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((dateStr, cellIdx) => {
            if (!dateStr) return <View key={`e${cellIdx}`} style={styles.cell} />;
            const day = parseInt(dateStr.split('-')[2], 10);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const isPast = dateStr < todayStr;
            const dayEvents = eventsByDate.get(dateStr) ?? [];

            return (
              <Pressable key={dateStr} style={styles.cell} onPress={() => onSelectDate(dateStr)}>
                {/* Day number circle */}
                <View style={[
                  styles.dayCircle,
                  isToday && styles.dayCircleToday,
                  isSelected && !isToday && styles.dayCircleSelected,
                ]}>
                  <Text style={[
                    styles.dayNum,
                    isToday && styles.dayNumToday,
                    isSelected && !isToday && styles.dayNumSelected,
                    isPast && !isToday && !isSelected && styles.dayNumPast,
                  ]}>
                    {day}
                  </Text>
                </View>

                {/* Event summary chips inside the cell */}
                {dayEvents.slice(0, 2).map((title, i) => (
                  <View
                    key={i}
                    style={[
                      styles.eventChip,
                      isToday && styles.eventChipToday,
                      isSelected && !isToday && styles.eventChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.eventChipText,
                        isToday && styles.eventChipTextToday,
                        isSelected && !isToday && styles.eventChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {title}
                    </Text>
                  </View>
                ))}
                {dayEvents.length > 2 && (
                  <Text style={[styles.moreText, isToday && styles.moreTextToday]}>
                    +{dayEvents.length - 2}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.sm,
    marginBottom: sizes.md,
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  } as never,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sizes.sm,
    paddingHorizontal: 2,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center', alignItems: 'center',
  },
  navText: { fontSize: 20, color: colors.primary, ...font.semibold, lineHeight: 24 },
  monthTitle: { fontSize: sizes.fontMd, ...font.bold, color: colors.textPrimary },

  row: { flexDirection: 'row' },
  headerCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  // Cell has no fixed height — grows with content
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3, paddingHorizontal: 1, minHeight: 54 },

  dayHeaderText: { fontSize: sizes.fontXs, ...font.semibold, color: colors.textSecondary },
  dayCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  dayCircleToday: { backgroundColor: colors.primary },
  dayCircleSelected: { backgroundColor: colors.primary + '18' },
  dayNum: { fontSize: 13, ...font.medium, color: colors.textPrimary },
  dayNumToday: { color: colors.white, ...font.bold },
  dayNumSelected: { color: colors.primary, ...font.bold },
  dayNumPast: { color: colors.textDisabled },

  // Event chips inside calendar cells
  eventChip: {
    width: '100%',
    backgroundColor: colors.primary + '18',
    borderRadius: 3,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginTop: 2,
  },
  eventChipToday: { backgroundColor: 'rgba(255,255,255,0.25)' },
  eventChipSelected: { backgroundColor: colors.primary + '28' },
  eventChipText: {
    fontSize: 9,
    ...font.semibold,
    color: colors.primary,
    lineHeight: 12,
  },
  eventChipTextToday: { color: colors.white },
  eventChipTextSelected: { color: colors.primary },
  moreText: { fontSize: 9, ...font.regular, color: colors.textSecondary, marginTop: 1 },
  moreTextToday: { color: colors.white },
});
