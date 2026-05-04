import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  AppState,
  ActivityIndicator,
  type AppStateStatus,
  type ListRenderItemInfo,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  useParkingStore,
  isDateConflict,
  type ParkingReservation,
  type ParkingSession,
  type ParkingVote,
} from '@stores/parkingStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore, type Housemate } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { CalendarPicker } from '@components/shared/CalendarPicker';
import { TimePicker } from '@components/shared/TimePicker';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

const SURFACE_BG = 'rgba(251,248,245,0.96)';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Vote status row ────────────────────────────────────────────────────────────
function VoteRow({
  votes,
  housemates,
  requestedBy,
}: {
  votes: ParkingVote[];
  housemates: Housemate[];
  requestedBy: string;
}): React.JSX.Element {
  const voters = housemates.filter((h) => h.id !== requestedBy);
  if (voters.length === 0) return <View />;

  return (
    <View style={styles.voteRow}>
      {voters.map((h) => {
        const v = votes.find((vote) => vote.userId === h.id);
        const dotStyle =
          v?.vote === 'approve' ? styles.dotApprove
          : v?.vote === 'reject' ? styles.dotReject
          : styles.dotPending;
        const dotIcon =
          v?.vote === 'approve' ? 'checkmark'
          : v?.vote === 'reject' ? 'close'
          : 'remove';
        return (
          <View key={h.id} style={styles.voteAvatarWrap}>
            <View style={[styles.voteAvatarCircle, { backgroundColor: h.color + '30' }]}>
              <Text style={[styles.voteAvatarInitial, { color: h.color }]}>
                {h.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={[styles.voteDot, dotStyle]}>
              <Ionicons name={dotIcon as 'checkmark' | 'close' | 'remove'} size={7} color="#fff" />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ── Reservation card ───────────────────────────────────────────────────────────
function ReservationCard({
  item,
  currentUserId,
  onCancel,
  onVote,
  onClear,
  isHistory,
}: {
  item: ParkingReservation;
  currentUserId: string;
  onCancel: (id: string) => void;
  onVote: (id: string, vote: 'approve' | 'reject') => void;
  onClear: (id: string) => void;
  isHistory: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const isOwn = item.requestedBy === currentUserId;
  const isPending = item.status === 'pending';
  const approved = item.status === 'approved';
  const rejected = item.status === 'rejected';

  const statusColor = approved ? colors.positive : rejected ? colors.danger : colors.warning;
  const statusBg = approved
    ? colors.positive + '20'
    : rejected
    ? colors.danger + '15'
    : colors.warning + '20';
  const statusLabel = approved
    ? t('parking.approved')
    : rejected
    ? 'Rejected'
    : t('parking.pending');

  const timeLabel = item.startTime
    ? ` · ${item.startTime}${item.endTime ? `–${item.endTime}` : ''}`
    : '';

  const myVote = item.votes.find((v) => v.userId === currentUserId);
  const canVote = !isOwn && isPending;

  return (
    <View style={[styles.resCard, isHistory && styles.resCardDim]}>
      <View style={styles.resIconWrap}>
        <Ionicons name="calendar-outline" size={18} color={statusColor} />
      </View>

      <View style={styles.resInfo}>
        <Text style={styles.resDate}>
          {formatDate(item.date)}
          {timeLabel}
        </Text>
        <Text style={styles.resBy}>
          {isOwn ? 'You' : resolveName(item.requestedBy, housemates)}
          {item.note ? ` · ${item.note}` : ''}
        </Text>

        <VoteRow votes={item.votes} housemates={housemates} requestedBy={item.requestedBy} />

        <View style={[styles.badge, { backgroundColor: statusBg }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.resActions}>
        {isOwn && isPending && (
          <Pressable
            onPress={() => onCancel(item.id)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel reservation"
          >
            <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
          </Pressable>
        )}

        {isHistory && (
          <Pressable
            onPress={() => onClear(item.id)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear from history"
          >
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        )}

        {canVote && (
          <View style={styles.voteBtns}>
            <Pressable
              onPress={() => onVote(item.id, 'approve')}
              style={[styles.voteBtn, myVote?.vote === 'approve' && styles.voteBtnApproveActive]}
              accessibilityRole="button"
              accessibilityLabel="Approve parking request"
            >
              <Ionicons
                name="checkmark"
                size={15}
                color={myVote?.vote === 'approve' ? '#fff' : colors.positive}
              />
            </Pressable>
            <Pressable
              onPress={() => onVote(item.id, 'reject')}
              style={[styles.voteBtn, myVote?.vote === 'reject' && styles.voteBtnRejectActive]}
              accessibilityRole="button"
              accessibilityLabel="Reject parking request"
            >
              <Ionicons
                name="close"
                size={15}
                color={myVote?.vote === 'reject' ? '#fff' : colors.danger}
              />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Reserve modal ──────────────────────────────────────────────────────────────
function ReserveModal({
  visible,
  onClose,
  myId,
  myName,
  houseId,
  reservations,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  myId: string;
  myName: string;
  houseId: string;
  reservations: ParkingReservation[];
  current: ParkingSession | null;
}): React.JSX.Element {
  const { t } = useTranslation();
  const addReservation = useParkingStore((s) => s.addReservation);
  const syncParkingPending = useCalendarSyncStore((s) => s.syncParkingPending);
  const housemates = useHousematesStore((s) => s.housemates);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeConflict =
    current && date === todayStr
      ? `${current.occupant === myId ? 'You are' : `${resolveName(current.occupant, housemates)} is`} currently using the spot`
      : null;
  const dateConflict = activeConflict ?? isDateConflict(date, reservations);

  const reset = useCallback((): void => {
    setDate(todayStr);
    setStartTime('');
    setEndTime('');
    setNote('');
    setError('');
  }, [todayStr]);

  const handleClose = useCallback((): void => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (dateConflict) { setError(dateConflict); return; }
    setSaving(true);
    setError('');
    try {
      const reservationId = await addReservation(
        { requestedBy: myId, date, startTime: startTime || undefined, endTime: endTime || undefined, note },
        myName,
        houseId
      );
      syncParkingPending({
        id: reservationId,
        requestedBy: myName,
        date,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      }).catch(() => {});
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_reservation'));
    } finally {
      setSaving(false);
    }
  }, [dateConflict, date, startTime, endTime, note, myId, myName, houseId, addReservation, handleClose, syncParkingPending, t]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Reserve Parking</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <Text style={styles.fieldLabel}>Date</Text>
            <CalendarPicker value={date} onChange={(d) => { setDate(d); setError(''); }} />

            {!!dateConflict && (
              <View style={styles.conflictBox}>
                <Ionicons name="warning-outline" size={13} color={colors.warning} />
                <Text style={styles.conflictText}>{dateConflict}</Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Start time (optional)</Text>
            <TimePicker value={startTime} onChange={setStartTime} />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>End time (optional)</Text>
            <TimePicker value={endTime} onChange={setEndTime} />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('parking.note_label')}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={styles.fieldInput}
              placeholder={t('parking.note_placeholder')}
              placeholderTextColor={colors.textSecondary}
            />

            {!!error && <Text style={styles.fieldError}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalBtns}>
            <Pressable style={styles.modalBtnOutline} onPress={handleClose} accessibilityRole="button">
              <Text style={styles.modalBtnOutlineText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtnPrimary, (saving || !!dateConflict) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving || !!dateConflict}
              accessibilityRole="button"
            >
              <Text style={styles.modalBtnPrimaryText}>{saving ? '…' : t('parking.request')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── List item union type ───────────────────────────────────────────────────────
type FlatItem =
  | { _k: 'res'; res: ParkingReservation; isHistory: boolean }
  | { _k: 'hist-header'; count: number };

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ParkingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const isLoading = useParkingStore((s) => s.isLoading);
  const current = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const claim = useParkingStore((s) => s.claim);
  const release = useParkingStore((s) => s.release);
  const cancelReservation = useParkingStore((s) => s.cancelReservation);
  const voteOnReservation = useParkingStore((s) => s.voteOnReservation);
  const clearHistoryItem = useParkingStore((s) => s.clearHistoryItem);
  const checkReservationAutoApply = useParkingStore((s) => s.checkReservationAutoApply);

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const syncParkingApproved = useCalendarSyncStore((s) => s.syncParkingApproved);
  const removeCalendarEvent = useCalendarSyncStore((s) => s.removeCalendarEvent);

  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const isMine = current?.occupant === myId;
  const isFree = !current;

  const [showReserve, setShowReserve] = useState(false);
  const [error, setError] = useState('');

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (!houseId) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        checkReservationAutoApply(houseId);
      }
      appStateRef.current = nextState;
    });
    const interval = setInterval(() => { checkReservationAutoApply(houseId ?? ''); }, 60_000);
    return (): void => { sub.remove(); clearInterval(interval); };
  }, [houseId, checkReservationAutoApply]);

  // Split into upcoming (date >= today) and history (date < today)
  // Plain const so the value refreshes each render — same-day string equality
  // prevents the downstream memos from re-running, but a midnight transition
  // will produce a new string and correctly re-categorize reservations.
  const today = todayString();
  const upcoming = useMemo(
    () => reservations.filter((r) => r.date >= today),
    [reservations, today]
  );
  const history = useMemo(
    () => reservations.filter((r) => r.date < today),
    [reservations, today]
  );

  const listData = useMemo((): FlatItem[] => [
    ...upcoming.map((r) => ({ _k: 'res' as const, res: r, isHistory: false })),
    ...(history.length > 0 ? [{ _k: 'hist-header' as const, count: history.length }] : []),
    ...history.map((r) => ({ _k: 'res' as const, res: r, isHistory: true })),
  ], [upcoming, history]);

  const handleClaim = useCallback(async (): Promise<void> => {
    setError('');
    try {
      await claim(myId, myName, houseId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_claim'));
    }
  }, [claim, myId, myName, houseId, t]);

  const handleRelease = useCallback(async (): Promise<void> => {
    setError('');
    try {
      await release(houseId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_release'));
    }
  }, [release, houseId, t]);

  const handleCancel = useCallback(async (id: string): Promise<void> => {
    try {
      await cancelReservation(id, houseId ?? '');
      removeCalendarEvent(`pk-${id}`).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_release'));
    }
  }, [cancelReservation, houseId, removeCalendarEvent, t]);

  const handleVote = useCallback(async (id: string, vote: 'approve' | 'reject'): Promise<void> => {
    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;
    // All housemates except the requester must vote
    const otherMemberIds = housemates
      .filter((h) => h.id !== reservation.requestedBy)
      .map((h) => h.id);
    try {
      const resultStatus = await voteOnReservation(id, vote, houseId ?? '', otherMemberIds);
      if (resultStatus === 'approved') {
        syncParkingApproved({
          id: reservation.id,
          requestedBy: resolveName(reservation.requestedBy, housemates),
          date: reservation.date,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
        }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your vote');
    }
  }, [voteOnReservation, reservations, housemates, houseId, syncParkingApproved]);

  const handleClear = useCallback(async (id: string): Promise<void> => {
    try {
      await clearHistoryItem(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear this item');
    }
  }, [clearHistoryItem]);

  const keyExtractor = useCallback((item: FlatItem): string =>
    item._k === 'hist-header' ? 'history-header' : item.res.id
  , []);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<FlatItem>): React.JSX.Element => {
    if (item._k === 'hist-header') {
      return (
        <View style={styles.historyHeaderRow}>
          <Text style={styles.eyebrow}>History</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{item.count}</Text>
          </View>
        </View>
      );
    }
    return (
      <ReservationCard
        item={item.res}
        currentUserId={myId}
        onCancel={handleCancel}
        onVote={handleVote}
        onClear={handleClear}
        isHistory={item.isHistory}
      />
    );
  }, [myId, handleCancel, handleVote, handleClear]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}

        ListHeaderComponent={
          <View>
            {/* ── Hero card ── */}
            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <Text style={styles.titleHero}>{t('parking.title')}</Text>
                <Text style={styles.textBase}>
                  {isFree
                    ? 'The spot is open — claim it before someone else does.'
                    : isMine
                    ? `You claimed it at ${formatTime(current!.startTime)}.`
                    : `${resolveName(current?.occupant ?? '', housemates)} is parked since ${formatTime(current!.startTime)}.`}
                </Text>
              </View>

              <View style={[styles.statusCircle, { backgroundColor: isFree ? colors.positive + '18' : colors.negative + '18' }]}>
                <Ionicons
                  name={isFree ? 'car-outline' : 'car'}
                  size={38}
                  color={isFree ? colors.positive : colors.negative}
                />
                <Text style={[styles.statusLabel, { color: isFree ? colors.positive : colors.negative }]}>
                  {isFree ? 'Free' : 'Taken'}
                </Text>
              </View>

              {isFree && (
                <Pressable style={styles.btnPrimary} onPress={handleClaim} accessibilityRole="button">
                  <Ionicons name="car" size={16} color="#fff" style={styles.btnIcon} />
                  <Text style={styles.btnPrimaryText}>{t('parking.claim')}</Text>
                </Pressable>
              )}
              {isMine && (
                <Pressable style={styles.btnDanger} onPress={handleRelease} accessibilityRole="button">
                  <Ionicons name="exit-outline" size={16} color={colors.danger} style={styles.btnIcon} />
                  <Text style={styles.btnDangerText}>{t('parking.release')}</Text>
                </Pressable>
              )}
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={14} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {isLoading && (
              <ActivityIndicator size="small" color="#4F78B6" style={styles.loadingIndicator} />
            )}

            {/* ── Reservations section header ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.eyebrow}>{t('parking.reservations')}</Text>
              <Pressable onPress={() => setShowReserve(true)} style={styles.addBtn} accessibilityRole="button">
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addBtnText}>{t('parking.reserve')}</Text>
              </Pressable>
            </View>

            {upcoming.length > 0 && (
              <View style={styles.subHeaderRow}>
                <Text style={styles.eyebrow}>{t('parking.upcoming')}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{upcoming.length}</Text>
                </View>
              </View>
            )}
          </View>
        }

        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={36} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>{t('parking.no_reservations')}</Text>
            <Text style={styles.emptyText}>
              Reserve ahead of time so housemates know when the spot is taken.
            </Text>
          </View>
        }
      />

      <ReserveModal
        visible={showReserve}
        onClose={() => setShowReserve(false)}
        myId={myId}
        myName={myName}
        houseId={houseId ?? ''}
        reservations={reservations}
        current={current}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  sep: { height: 8 },

  heroCard: {
    backgroundColor: SURFACE_BG,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 20, gap: 16, marginBottom: 24,
    boxShadow: '0 8px 24px rgba(44,51,61,0.05)',
  } as never,
  heroCopy: { gap: 6 },
  titleHero: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.78 },
  textBase: { fontSize: 15, ...font.regular, color: colors.textSecondary, lineHeight: 22 },

  statusCircle: {
    alignSelf: 'center',
    width: 96, height: 96, borderRadius: 48,
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  statusLabel: { fontSize: 12, ...font.bold, letterSpacing: 0.6 },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: colors.primary,
    boxShadow: '0 8px 16px rgba(79,120,182,0.18)',
  } as never,
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: colors.danger + '15',
    borderWidth: 1, borderColor: colors.danger + '30',
  },
  btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
  btnDangerText: { fontSize: 15, ...font.semibold, color: colors.danger },
  btnIcon: { marginRight: 6 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '15',
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9999,
  },
  addBtnText: { fontSize: 13, ...font.semibold, color: colors.primary },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 12,
  },
  subHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, marginBottom: 12,
  },
  eyebrow: {
    fontSize: 12, ...font.bold, color: colors.textSecondary,
    letterSpacing: 0.72, textTransform: 'uppercase',
  },
  countPill: {
    minHeight: 22, paddingHorizontal: 8, borderRadius: 9999,
    backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  countPillText: { fontSize: 11, ...font.bold, color: colors.secondaryForeground },

  historyHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, paddingTop: 16, paddingBottom: 8,
  },

  // ── Reservation card
  resCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(44,51,61,0.02)',
  } as never,
  resCardDim: { opacity: 0.72 },
  resIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
    marginTop: 2,
  },
  resInfo: { flex: 1, gap: 4 },
  resDate: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  resBy: { fontSize: 13, ...font.regular, color: colors.textSecondary },

  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 9999, marginTop: 2,
  },
  badgeText: { fontSize: 11, ...font.semibold },

  resActions: { gap: 6, alignItems: 'center', paddingTop: 2 },
  iconBtn: { padding: 4 },

  // ── Vote row (avatars + dots)
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  voteAvatarWrap: { position: 'relative', width: 28, height: 28 },
  voteAvatarCircle: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  voteAvatarInitial: { fontSize: 11, ...font.bold },
  voteDot: {
    position: 'absolute', bottom: -1, right: -1,
    width: 13, height: 13, borderRadius: 7,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.surface,
  },
  dotApprove: { backgroundColor: colors.positive },
  dotReject:  { backgroundColor: colors.danger },
  dotPending: { backgroundColor: colors.textSecondary + '80' },

  // ── Vote buttons (Approve / Reject)
  voteBtns: { flexDirection: 'row', gap: 6 },
  voteBtn: {
    width: 32, height: 32, borderRadius: 9999,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  voteBtnApproveActive: {
    backgroundColor: colors.positive,
    borderColor: colors.positive,
  },
  voteBtnRejectActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: 14, ...font.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.danger + '15', borderRadius: 10,
    padding: 12, marginBottom: 16,
  },
  errorText: { fontSize: 13, ...font.regular, color: colors.danger, flex: 1 },
  loadingIndicator: { marginBottom: 12 },

  // ── Reserve Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 12,
    maxHeight: '90%',
  },
  modalScroll: { flexGrow: 0 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 20, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },
  fieldLabel: { fontSize: 13, ...font.semibold, color: colors.textPrimary, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, ...font.regular, color: colors.textPrimary,
    backgroundColor: colors.surfaceSecondary,
  },
  fieldError: { fontSize: 13, ...font.regular, color: colors.negative },
  conflictBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  conflictText: { fontSize: 13, ...font.medium, color: colors.warning, flex: 1 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalBtnOutline: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border, alignItems: 'center',
  },
  modalBtnOutlineText: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  modalBtnPrimary: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  modalBtnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
});
