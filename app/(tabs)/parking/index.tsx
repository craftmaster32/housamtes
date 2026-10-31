import { useState, useCallback, useMemo } from 'react';
import { useScrollToTopOnNav } from '@hooks/useScrollToTopOnNav';
import {
  View,
  StyleSheet,
  FlatList,
  Platform,
  Pressable,
  type ListRenderItemInfo,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import { BackLink } from '@components/shared/BackLink';
import { Mate } from '@components/shared/Mate';
import { MateCameo } from '@components/shared/MateCameo';
import { MateSpot } from '@components/shared/MateSpot';
import { useMateScene } from '@hooks/useMateScene';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { EmptyState } from '@components/ui';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { DayTiles } from '@components/parking/DayTiles';
import { DayScheduleSheet } from '@components/parking/DayScheduleSheet';
import { PaperSlice } from '@components/parking/PaperSlice';
import { ReservationLine } from '@components/parking/ReservationLine';
import { ReserveSheet } from '@components/parking/ReserveSheet';
import { SpotCard } from '@components/parking/SpotCard';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useParkingActions } from '@hooks/useParkingActions';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import {
  useParkingStore,
  findBlockedReservation,
  type ParkingReservation,
} from '@stores/parkingStore';
import { resolveName } from '@utils/housemates';
import { formatSince, todayString } from '@utils/parkingDates';
import { mf, ms } from '@utils/responsive';

// ── List item union type ───────────────────────────────────────────────────────
type FlatItem =
  | { _k: 'res'; res: ParkingReservation; isHistory: boolean }
  | { _k: 'hist-header'; count: number };

// ── Main screen ────────────────────────────────────────────────────────────────
function ParkingScreen(): React.JSX.Element {
  // Tapping your way here (even from this page) shows the top of the page.
  const scrollRef = useScrollToTopOnNav('parking/index');
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const isLoading = useParkingStore((s) => s.isLoading);
  const current = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const language = useLanguageStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);
  const housemates = useHousematesStore((s) => s.housemates);
  const actions = useParkingActions();
  const { now } = actions;

  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const isMine = current?.occupant === myId;
  const isAdmin = role === 'owner' || role === 'admin';
  const [showReserve, setShowReserve] = useState(false);
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null);
  const handleDatePress = useCallback((date: string) => setDaySheetDate(date), []);
  const openReserve = useCallback(() => setShowReserve(true), []);
  const closeReserve = useCallback(() => setShowReserve(false), []);
  const closeDaySheet = useCallback(() => setDaySheetDate(null), []);

  const blockedReservation = useMemo(
    () => findBlockedReservation(current, reservations, now),
    [current, reservations, now]
  );
  const nameOf = useCallback(
    (id: string): string => resolveName(id, housemates, t('common.unknown')),
    [housemates, t]
  );
  const occupantName = nameOf(current?.occupant ?? '');
  // The big headline only has room for a first name; the line below keeps the
  // full one. The "unknown" fallback is kept whole (in Hebrew its first word is "no").
  const isKnownOccupant = housemates.some((h) => h.id === current?.occupant);
  const occupantFirstName = isKnownOccupant
    ? occupantName.trim().split(/\s+/)[0] || occupantName
    : occupantName;
  const since = current?.startTime
    ? formatSince(current.startTime, language, t('common.yesterday').toLowerCase())
    : null;

  const statusLine = !current
    ? t('parking.free_real_estate')
    : isMine
      ? since
        ? since.day
          ? t('parking.your_car_since_day', { day: since.day, time: since.time })
          : t('parking.your_car_since', { time: since.time })
        : t('parking.your_car_all_day')
      : since
        ? since.day
          ? t('parking.took_spot_since_day', {
              name: occupantName,
              day: since.day,
              time: since.time,
            })
          : t('parking.took_spot_since', { name: occupantName, time: since.time })
        : t('parking.took_spot_all_day', { name: occupantName });

  // Split into upcoming (date >= today) and history (date < today)
  // Plain const so the value refreshes each render — same-day string equality
  // prevents the downstream memos from re-running, but a midnight transition
  // will produce a new string and correctly re-categorize reservations.
  const today = todayString();
  const upcoming = useMemo(
    () => reservations.filter((r) => r.date >= today),
    [reservations, today]
  );
  const history = useMemo(() => reservations.filter((r) => r.date < today), [reservations, today]);
  const listData = useMemo(
    (): FlatItem[] => [
      ...upcoming.map((r) => ({ _k: 'res' as const, res: r, isHistory: false })),
      ...(history.length > 0 ? [{ _k: 'hist-header' as const, count: history.length }] : []),
      ...history.map((r) => ({ _k: 'res' as const, res: r, isHistory: true })),
    ],
    [upcoming, history]
  );
  // An empty page already has its own Mate, so he only hides when there's a list.
  const mateSpot = useMateScene(MATE_SPOTS, listData.length > 0);

  const keyExtractor = useCallback(
    (item: FlatItem): string => (item._k === 'hist-header' ? 'history-header' : item.res.id),
    []
  );

  // Every row is a slice of one notebook page: the first rounds the top, the
  // last tears off, and reservations that follow another get a dashed rule.
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<FlatItem>): React.JSX.Element => {
      const isFirst = index === 0;
      const isLast = index === listData.length - 1;
      if (item._k === 'hist-header') {
        return (
          <PaperSlice isFirst={isFirst} isLast={isLast}>
            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, headingFont, { color: c.paperInk }]}>
                {`${t('parking.history')} · ${item.count}`}
              </Text>
              <Pressable
                onPress={actions.handleClearAll}
                style={({ pressed }) => [styles.clearAll, pressed && styles.pressed]}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('parking.clear_all_history')}
              >
                <Text style={styles.clearAllText}>{t('parking.clear_all')}</Text>
              </Pressable>
            </View>
          </PaperSlice>
        );
      }
      const prev = listData[index - 1];
      return (
        <PaperSlice isFirst={isFirst} isLast={isLast} dashedTop={prev?._k === 'res'}>
          <ReservationLine
            item={item.res}
            currentUserId={myId}
            isAdmin={isAdmin}
            onCancel={actions.handleCancel}
            onVote={actions.handleVote}
            onClear={actions.handleClear}
            onDatePress={handleDatePress}
            isHistory={item.isHistory}
            now={now}
          />
        </PaperSlice>
      );
    },
    [listData, myId, isAdmin, actions, handleDatePress, now, headingFont, c, t]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <FlatList
        ref={scrollRef}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <BackLink label={t('common.home')} />
            <Text
              style={[styles.pageTitle, headingFont, { color: c.textPrimary }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {t('parking.title')}
            </Text>

            <SpotCard
              current={current}
              isMine={isMine}
              occupantName={occupantFirstName}
              statusLine={statusLine}
              blockedReservation={blockedReservation}
              myId={myId}
              nameOf={nameOf}
              onPress={actions.handleSpotPress}
            />

            {!!actions.error && (
              <View style={styles.errorRow} accessibilityRole="alert">
                <Ionicons name="warning-outline" size={15} color={c.danger} />
                <Text style={[styles.errorText, { color: c.danger }]}>{actions.error}</Text>
              </View>
            )}

            {/* Mate on a rope, dropped off the spot card over the week (sometimes). */}
            {mateSpot === 'rope' && (
              <View style={styles.mateAnchor}>
                <MateSpot kind="rope" size={ms(34)} ropeLength={ms(44)} style={styles.mateRope} />
              </View>
            )}

            <DayTiles onDayPress={handleDatePress} />

            {mateSpot === 'sit' && (
              <View style={styles.mateAnchor}>
                <MateSpot kind="sit" size={ms(34)} style={styles.mateSit} />
              </View>
            )}

            <View style={styles.sectionHeader}>
              <Text
                style={[styles.sectionTitle, headingFont, { color: c.textPrimary }]}
                accessibilityRole="header"
              >
                {t('parking.reservations')}
              </Text>
              <PaperTag label={t('parking.reserve')} onPress={openReserve} />
            </View>
          </View>
        }
        ListFooterComponent={mateSpot === 'footer' ? <MateCameo page="parking" always /> : null}
        ListEmptyComponent={
          isLoading ? (
            <EmptyState mode="loading" title={t('common.loading')} />
          ) : (
            // Mate keeps the empty page company — the one Mate on this screen.
            <NotebookPaper contentStyle={styles.emptyPage}>
              <Mate size={ms(80)} />
              <Text style={[styles.emptyTitle, headingFont, { color: c.paperInk }]}>
                {t('parking.no_reservations')}
              </Text>
              <Text style={[styles.emptyText, { color: c.paperMuted }]}>
                {t('parking.no_reservations_hint')}
              </Text>
            </NotebookPaper>
          )
        }
      />

      <DayScheduleSheet
        date={daySheetDate}
        onClose={closeDaySheet}
        currentUserId={myId}
        now={now}
      />

      <ReserveSheet
        visible={showReserve}
        onClose={closeReserve}
        myId={myId}
        myName={myName}
        houseId={houseId ?? ''}
        reservations={reservations}
        current={current}
      />
    </SafeAreaView>
  );
}

// Where Mate may hide on a visit: on a rope off the spot card, sitting under
// the week, or at the end of the reservations (one at most, sometimes none).
const MATE_SPOTS = ['rope', 'sit', 'footer'] as const;

const styles = StyleSheet.create({
  mateAnchor: { height: 0, zIndex: 2 },
  mateRope: { end: '24%', top: -ms(12) },
  mateSit: { start: '20%', top: -ms(14) },
  container: { flex: 1 },
  list: {
    paddingHorizontal: ms(16),
    paddingTop: ms(4),
    // On web the tab bar floats over the page, so leave its full height free
    // (as Bills does) — otherwise the last rows hide behind it.
    paddingBottom: Platform.OS === 'web' ? sizes.bottomTabBarHeight : sizes.bottomTabContentPadding,
  },
  pageTitle: {
    fontSize: mf(36),
    // Tall enough for the descenders (the "g" in Parking was being clipped).
    lineHeight: mf(46),
    paddingBottom: ms(2),
    letterSpacing: -1,
    marginTop: ms(6),
    marginBottom: ms(14),
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), marginTop: ms(12) },
  errorText: { flex: 1, fontSize: mf(14), ...font.medium },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ms(12),
    marginTop: ms(24),
    marginBottom: ms(12),
  },
  sectionTitle: { fontSize: mf(22), letterSpacing: -0.4 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: ms(14),
    paddingBottom: ms(2),
    paddingStart: ms(74),
    paddingEnd: ms(12),
  },
  historyTitle: { fontSize: mf(18) },
  clearAll: { minHeight: 44, justifyContent: 'center' },
  clearAllText: { fontSize: mf(13.5), ...font.bold, color: '#B84540' },
  pressed: { opacity: 0.7 },
  emptyPage: {
    alignItems: 'center',
    paddingTop: ms(24),
    paddingBottom: ms(30),
    paddingHorizontal: ms(28),
    gap: ms(6),
  },
  emptyTitle: { fontSize: mf(19), textAlign: 'center', marginTop: ms(8) },
  emptyText: { fontSize: mf(14), ...font.medium, textAlign: 'center', lineHeight: mf(20) },
});

export default withFeatureGuard('parking', ParkingScreen);
