import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useEventsStore, type HouseEvent } from '@stores/eventsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useLanguageStore } from '@stores/languageStore';
import { useCalendarEvents } from '@hooks/useCalendarEvents';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { openGoogleCalendar, downloadIcs } from '@utils/calendarWeb';
import { resolveName } from '@utils/housemates';
import { isRTL } from '@lib/i18n';
import { Alert } from '@lib/alert';
import { BackLink } from '@components/shared/BackLink';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { WallCalendar, type DayMark } from '@components/calendar/WallCalendar';
import { EventEntry, type EventSyncState } from '@components/calendar/EventEntry';
import { EventFormSheet } from '@components/calendar/EventFormSheet';
import {
  EVENT_TYPES,
  toYMD,
  typeColor,
  typeLabelKey,
  type CalendarEvent,
} from '@components/calendar/calendarMeta';
import { lightColors, useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

export default function CalendarScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const rtl = isRTL(language);
  const events = useEventsStore((s) => s.events);
  const isLoading = useEventsStore((s) => s.isLoading);
  const storeError = useEventsStore((s) => s.error);
  const removeEvent = useEventsStore((s) => s.removeEvent);
  const housemates = useHousematesStore((s) => s.housemates);

  const connected = useCalendarSyncStore((s) => s.connected);
  const autoSync = useCalendarSyncStore((s) => s.autoSync);
  const eventMap = useCalendarSyncStore((s) => s.eventMap);
  const syncHouseEvent = useCalendarSyncStore((s) => s.syncHouseEvent);
  const syncParkingApproved = useCalendarSyncStore((s) => s.syncParkingApproved);
  const syncParkingPending = useCalendarSyncStore((s) => s.syncParkingPending);
  const connect = useCalendarSyncStore((s) => s.connect);

  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();

  const today = new Date();
  const todayStr = toYMD(today);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<HouseEvent | undefined>(undefined);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [gridStart, gridEnd] = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    end.setHours(23, 59, 59);
    return [start, end];
  }, [viewYear, viewMonth]);

  const allEvents = useCalendarEvents(gridStart, gridEnd);

  const marks = useMemo((): Record<string, DayMark[]> => {
    const map: Record<string, DayMark[]> = {};
    for (const e of allEvents) {
      (map[e.date] ??= []).push({ title: e.title, color: typeColor(e.type, lightColors) });
    }
    return map;
  }, [allEvents]);

  const selectedEvents = useMemo(
    () =>
      allEvents
        .filter((e) => e.date === selectedDate)
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [allEvents, selectedDate]
  );

  const prevMonth = useCallback((): void => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback((): void => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  const handleSelectDay = useCallback((ymd: string): void => {
    setSelectedDate(ymd);
    setExpandedEventId(null);
  }, []);

  const handleOpenAdd = useCallback((): void => {
    setEditingEvent(undefined);
    setShowForm(true);
  }, []);

  const handleEditEvent = useCallback(
    (sourceId: string): void => {
      const ev = events.find((e) => e.id === sourceId);
      if (ev) {
        setEditingEvent(ev);
        setShowForm(true);
      }
    },
    [events]
  );

  const handleCloseForm = useCallback((): void => {
    setShowForm(false);
    setEditingEvent(undefined);
  }, []);

  const handleToggle = useCallback(
    (id: string): void => setExpandedEventId((cur) => (cur === id ? null : id)),
    []
  );

  const handleDelete = useCallback(
    async (sourceId: string): Promise<void> => {
      try {
        await removeEvent(sourceId);
      } catch {
        Alert.alert(t('calendar.remove_error_title'), t('calendar.remove_error_body'));
      }
    },
    [removeEvent, t]
  );

  const handleSync = useCallback(
    async (item: CalendarEvent): Promise<void> => {
      try {
        if (!connected) {
          const ok = await connect();
          if (!ok) return;
        }
        const who = resolveName(item.person ?? '', housemates);
        if (item.type === 'event') {
          await syncHouseEvent({
            id: item.sourceId,
            title: item.title,
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
            createdBy: item.createdBy,
          });
        } else if (item.type === 'parking') {
          await syncParkingApproved({
            id: item.sourceId,
            requestedBy: who,
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
          });
        } else if (item.type === 'parking-pending') {
          await syncParkingPending({
            id: item.sourceId,
            requestedBy: who,
            date: item.date,
            startTime: item.startTime,
            endTime: item.endTime,
          });
        }
      } catch {
        Alert.alert(t('calendar.sync_failed_title'), t('calendar.sync_failed_body'));
      }
    },
    [connected, connect, syncHouseEvent, syncParkingApproved, syncParkingPending, housemates, t]
  );

  const handleGoogle = useCallback((item: CalendarEvent): void => {
    openGoogleCalendar({
      title: item.title,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
    });
  }, []);

  const handleIcs = useCallback((item: CalendarEvent): void => {
    downloadIcs({
      title: item.title,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
    });
  }, []);

  const syncStateFor = useCallback(
    (item: CalendarEvent): EventSyncState => {
      const isParking = item.type === 'parking' || item.type === 'parking-pending';
      const syncable = item.type === 'event' || isParking;
      const key = isParking ? `pk-${item.sourceId}` : `ev-${item.sourceId}-${item.date}`;
      const alreadySynced = !!eventMap[key];
      // Auto-synced entries are already in the member's calendar: no button.
      const autoHandled =
        alreadySynced &&
        connected &&
        ((item.type === 'event' && autoSync.events) || (isParking && autoSync.parking));
      return { showSync: syncable && !autoHandled, alreadySynced, webLinks: syncable };
    },
    [eventMap, connected, autoSync]
  );

  const renderEntry = useCallback(
    ({ item }: { item: CalendarEvent }): React.JSX.Element => (
      <EventEntry
        item={item}
        expanded={expandedEventId === item.id}
        sync={syncStateFor(item)}
        onToggle={handleToggle}
        onEdit={handleEditEvent}
        onDelete={handleDelete}
        onSync={handleSync}
        onGoogle={handleGoogle}
        onIcs={handleIcs}
      />
    ),
    [
      expandedEventId,
      syncStateFor,
      handleToggle,
      handleEditEvent,
      handleDelete,
      handleSync,
      handleGoogle,
      handleIcs,
    ]
  );

  const dayTitle =
    selectedDate === todayStr
      ? t('calendar.today')
      : new Date(selectedDate + 'T12:00:00').toLocaleDateString(i18n.language, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <BackLink label={t('common.home')} />
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, headingFont]}>{t('calendar.title')}</Text>
            <Text style={styles.subtitle}>
              {connected ? t('calendar.synced_subtitle') : t('calendar.house_schedule')}
            </Text>
          </View>
          <PaperTag label={t('calendar.add_event')} onPress={handleOpenAdd} />
        </View>

        {!!storeError && <Text style={styles.errorText}>{storeError}</Text>}

        {isLoading ? (
          <View style={styles.loading}>
            <LoadingSpinner accessibilityLabel={t('calendar.loading')} />
          </View>
        ) : (
          <>
            <WallCalendar
              year={viewYear}
              month={viewMonth}
              selected={selectedDate}
              today={todayStr}
              marks={marks}
              rtl={rtl}
              onSelect={handleSelectDay}
              onPrev={prevMonth}
              onNext={nextMonth}
            />

            {/* What each colour means, quietly under the page. */}
            <View style={styles.legend}>
              {EVENT_TYPES.map((type) => (
                <View key={type} style={styles.legendItem}>
                  <View
                    style={[styles.legendStroke, { backgroundColor: typeColor(type, lightColors) }]}
                  />
                  <Text style={styles.legendLabel}>{t(typeLabelKey(type))}</Text>
                </View>
              ))}
            </View>

            <View style={styles.dayHead}>
              <Text style={[styles.dayTitle, headingFont]}>{dayTitle}</Text>
              <Pressable
                style={styles.addLink}
                onPress={handleOpenAdd}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.add_event')}
              >
                <Text style={[styles.addLinkText, hand]}>+ {t('calendar.add')}</Text>
              </Pressable>
            </View>

            {selectedEvents.length === 0 ? (
              <Text style={[styles.empty, hand]}>{t('calendar.nothing_scheduled')}</Text>
            ) : (
              <FlatList
                data={selectedEvents}
                keyExtractor={(e) => e.id}
                scrollEnabled={false}
                renderItem={renderEntry}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
              />
            )}
          </>
        )}
      </ScrollView>

      <EventFormSheet
        visible={showForm}
        initialDate={selectedDate}
        editingEvent={editingEvent}
        onClose={handleCloseForm}
      />
    </SafeAreaView>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    scroll: { paddingHorizontal: ms(20), paddingTop: ms(8), paddingBottom: ms(60) },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: ms(10),
      marginBottom: ms(16),
    },
    headerCopy: { flex: 1, minWidth: 0 },
    title: {
      fontSize: mf(36),
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    subtitle: { fontSize: mf(14), ...font.regular, color: C.textSecondary },
    errorText: { fontSize: mf(13), ...font.regular, color: C.danger, marginBottom: ms(10) },
    loading: { paddingVertical: ms(60), alignItems: 'center' },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      columnGap: ms(14),
      rowGap: ms(4),
      marginTop: ms(14),
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: ms(5) },
    legendStroke: { width: ms(10), height: 3, borderRadius: 2 },
    legendLabel: { fontSize: mf(12), ...font.medium, color: C.textSecondary },
    dayHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: ms(22),
      marginBottom: ms(4),
    },
    dayTitle: { fontSize: mf(24), lineHeight: mf(31), color: C.textPrimary, flexShrink: 1 },
    addLink: { minHeight: 44, justifyContent: 'center', paddingStart: ms(10) },
    addLinkText: { fontSize: mf(22), color: C.primary },
    empty: { fontSize: mf(19), lineHeight: mf(23), color: C.textSecondary, marginTop: ms(6) },
    sep: { height: 1, backgroundColor: C.border, marginStart: ms(66) },
  });
}
