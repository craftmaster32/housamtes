// app/(tabs)/parking/index.tsx
// Parking — v2 redesign.
// Same data flow as v1 (useParkingStore, useAuthStore, useHousematesStore,
// useCalendarSyncStore). Same reserve modal flow. Same admin-cancel + voting
// behavior. New: blue hero with status, dark theme via useThemedColors,
// `type` ladder, `Header` UI primitive, fade-up entrance, press scale + haptics.

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, Pressable, TextInput, Modal, ScrollView,
  AppState, type AppStateStatus, type ListRenderItemInfo,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import {
  useParkingStore, isDateConflict,
  type ParkingReservation, type ParkingReservationStatus,
  type ParkingSession, type ParkingVote, type ParkingVoteChoice,
} from '@stores/parkingStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore, type Housemate } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { CalendarPicker } from '@components/shared/CalendarPicker';
import { TimePicker } from '@components/shared/TimePicker';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { Button, EmptyState, Header, Pill } from '@components/ui';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useFadeInUp, usePressScale, useHaptic, useCountUp } from '@utils/animations';

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

function elapsedSince(iso: string): { hours: number; mins: number } {
  const diff = Date.now() - new Date(iso).getTime();
  const totalMins = Math.max(0, Math.floor(diff / 60000));
  return { hours: Math.floor(totalMins / 60), mins: totalMins % 60 };
}

// ── Component prop interfaces ──────────────────────────────────────────────────
export interface VoteRowProps {
  votes: ParkingVote[];
  housemates: Housemate[];
  requestedBy: string;
  C: ColorTokens;
}

export interface ReservationCardProps {
  item: ParkingReservation;
  currentUserId: string;
  isAdmin: boolean;
  onCancel: (id: string) => void;
  onVote: (id: string, vote: ParkingVoteChoice) => void;
  onClear: (id: string) => void;
  isHistory: boolean;
  C: ColorTokens;
}

export interface ReserveModalProps {
  visible: boolean;
  onClose: () => void;
  myId: string;
  myName: string;
  houseId: string;
  reservations: ParkingReservation[];
  current: ParkingSession | null;
}

// ── Vote status row ────────────────────────────────────────────────────────────
function VoteRow({ votes, housemates, requestedBy, C }: VoteRowProps): React.JSX.Element {
  const styles = useMemo(() => makeStyles(C), [C]);
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
              <Text style={[type.captionMed, { color: h.color }]}>
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
  item, currentUserId, isAdmin, onCancel, onVote, onClear, isHistory, C,
}: ReservationCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(C), [C]);
  const housemates = useHousematesStore((s) => s.housemates);
  const isOwn      = item.requestedBy === currentUserId;
  const isPending  = item.status === 'pending';
  const approved   = item.status === 'approved';
  const rejected   = item.status === 'rejected';

  const statusTone: 'success' | 'warning' | 'danger' = approved ? 'success' : rejected ? 'danger' : 'warning';
  const statusLabel = approved
    ? t('parking.approved')
    : rejected
    ? t('parking.rejected')
    : t('parking.pending');

  const handleCancel  = useCallback(() => onCancel(item.id),          [onCancel, item.id]);
  const handleClear   = useCallback(() => onClear(item.id),           [onClear,  item.id]);
  const handleApprove = useCallback(() => onVote(item.id, 'approve'), [onVote,   item.id]);
  const handleReject  = useCallback(() => onVote(item.id, 'reject'),  [onVote,   item.id]);

  const timeLabel = item.startTime
    ? ` · ${item.startTime}${item.endTime ? `–${item.endTime}` : ''}`
    : '';

  const myVote          = item.votes.find((v) => v.userId === currentUserId);
  const canVote         = !isOwn && isPending;
  const canAdminCancel  = isAdmin && !isOwn && !isHistory && (isPending || approved);
  const showOwnCancel   = isOwn && isPending;

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(18)}
      style={[styles.resCard, isHistory && styles.resCardDim]}
    >
      <View style={styles.resIconWrap}>
        <Ionicons name="calendar-outline" size={18} color={approved ? C.positive : rejected ? C.danger : C.warning} />
      </View>

      <View style={styles.resInfo}>
        <Text style={[type.label, { color: C.textPrimary }]}>
          {formatDate(item.date)}
          {timeLabel}
        </Text>
        <Text style={[type.bodySm, { color: C.textSecondary }]}>
          {isOwn ? 'You' : resolveName(item.requestedBy, housemates)}
          {item.note ? ` · ${item.note}` : ''}
        </Text>

        <VoteRow votes={item.votes} housemates={housemates} requestedBy={item.requestedBy} C={C} />

        <View style={{ marginTop: 2 }}>
          <Pill tone={statusTone} size="sm">{statusLabel}</Pill>
        </View>
      </View>

      <View style={styles.resActions}>
        {showOwnCancel && (
          <IconBtn icon="close-circle-outline" color={C.danger} onPress={handleCancel} label="Cancel reservation" />
        )}
        {canAdminCancel && (
          <IconBtn icon="shield-outline" color={C.warning} onPress={handleCancel} label="Admin: cancel this reservation" />
        )}
        {isHistory && (
          <IconBtn icon="trash-outline" color={C.textSecondary} onPress={handleClear} label="Clear from history" />
        )}

        {canVote && (
          <View style={styles.voteBtns}>
            <VoteBtn
              icon="checkmark"
              active={myVote?.vote === 'approve'}
              activeBg={C.positive}
              borderColor={C.border}
              fg={C.positive}
              onPress={handleApprove}
              label="Approve parking request"
              C={C}
            />
            <VoteBtn
              icon="close"
              active={myVote?.vote === 'reject'}
              activeBg={C.danger}
              borderColor={C.border}
              fg={C.danger}
              onPress={handleReject}
              label="Reject parking request"
              C={C}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

function IconBtn({
  icon, color, onPress, label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  onPress: () => void;
  label: string;
}): React.JSX.Element {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ padding: 6, minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={20} color={color} />
      </Pressable>
    </Animated.View>
  );
}

function VoteBtn({
  icon, active, activeBg, borderColor, fg, onPress, label, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  activeBg: string;
  borderColor: string;
  fg: string;
  onPress: () => void;
  label: string;
  C: ColorTokens;
}): React.JSX.Element {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          width: 32, height: 32, borderRadius: 9999,
          justifyContent: 'center', alignItems: 'center',
          borderWidth: 1.5,
          borderColor: active ? activeBg : borderColor,
          backgroundColor: active ? activeBg : C.surfaceSecondary,
        }}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
      >
        <Ionicons name={icon} size={15} color={active ? '#fff' : fg} />
      </Pressable>
    </Animated.View>
  );
}

// ── Reserve modal ──────────────────────────────────────────────────────────────
function ReserveModal({
  visible, onClose, myId, myName, houseId, reservations, current,
}: ReserveModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const haptic = useHaptic();
  const addReservation     = useParkingStore((s) => s.addReservation);
  const syncParkingPending = useCalendarSyncStore((s) => s.syncParkingPending);
  const housemates         = useHousematesStore((s) => s.housemates);

  const todayStr = useMemo(() => todayString(), []);
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
    setStartTime(''); setEndTime(''); setNote(''); setError('');
  }, [todayStr]);

  const handleClose = useCallback((): void => { reset(); onClose(); }, [reset, onClose]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (dateConflict) { setError(dateConflict); return; }
    setSaving(true); setError('');
    try {
      const reservationId = await addReservation(
        { requestedBy: myId, date, startTime: startTime || undefined, endTime: endTime || undefined, note },
        myName, houseId,
      );
      syncParkingPending({
        id: reservationId, requestedBy: myName, date,
        startTime: startTime || undefined, endTime: endTime || undefined,
      }).catch(() => {});
      haptic.success();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_reservation'));
    } finally {
      setSaving(false);
    }
  }, [dateConflict, date, startTime, endTime, note, myId, myName, houseId, addReservation, handleClose, syncParkingPending, t, haptic]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={[type.title, { color: C.textPrimary }]}>Reserve Parking</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Text style={[type.captionMed, styles.fieldLabel, { color: C.textPrimary }]}>Date</Text>
            <CalendarPicker value={date} onChange={(d) => { setDate(d); setError(''); }} />

            {!!dateConflict && (
              <View style={styles.conflictBox}>
                <Ionicons name="warning-outline" size={13} color={C.warning} />
                <Text style={[type.bodySm, { color: C.warning, flex: 1 }]}>{dateConflict}</Text>
              </View>
            )}

            <Text style={[type.captionMed, styles.fieldLabel, { color: C.textPrimary, marginTop: 14 }]}>
              Start time (optional)
            </Text>
            <TimePicker value={startTime} onChange={setStartTime} />

            <Text style={[type.captionMed, styles.fieldLabel, { color: C.textPrimary, marginTop: 14 }]}>
              End time (optional)
            </Text>
            <TimePicker value={endTime} onChange={setEndTime} />

            <Text style={[type.captionMed, styles.fieldLabel, { color: C.textPrimary, marginTop: 14 }]}>
              {t('parking.note_label')}
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={styles.fieldInput}
              placeholder={t('parking.note_placeholder')}
              placeholderTextColor={C.textSecondary}
            />

            {!!error && <Text style={[type.bodySm, { color: C.negative, marginTop: 6 }]}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalBtns}>
            <Button variant="secondary" onPress={handleClose} fullWidth>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onPress={handleSave}
              loading={saving}
              disabled={saving || !!dateConflict}
              fullWidth
              haptic={null}
            >
              {saving ? '…' : t('parking.request')}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── List item union ───────────────────────────────────────────────────────────
type FlatItem =
  | { _k: 'res'; res: ParkingReservation; isHistory: boolean }
  | { _k: 'hist-header'; count: number };

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ParkingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const haptic = useHaptic();

  const isLoading             = useParkingStore((s) => s.isLoading);
  const current               = useParkingStore((s) => s.current);
  const reservations          = useParkingStore((s) => s.reservations);
  const claim                 = useParkingStore((s) => s.claim);
  const release               = useParkingStore((s) => s.release);
  const cancelReservation     = useParkingStore((s) => s.cancelReservation);
  const voteOnReservation     = useParkingStore((s) => s.voteOnReservation);
  const clearHistoryItem      = useParkingStore((s) => s.clearHistoryItem);
  const checkReservationAutoApply = useParkingStore((s) => s.checkReservationAutoApply);

  const profile        = useAuthStore((s) => s.profile);
  const houseId        = useAuthStore((s) => s.houseId);
  const role           = useAuthStore((s) => s.role);
  const housemates     = useHousematesStore((s) => s.housemates);
  const syncParkingApproved = useCalendarSyncStore((s) => s.syncParkingApproved);
  const removeCalendarEvent = useCalendarSyncStore((s) => s.removeCalendarEvent);

  const myId    = profile?.id ?? '';
  const myName  = profile?.name ?? '';
  const isMine  = current?.occupant === myId;
  const isFree  = !current;
  const isAdmin = role === 'owner' || role === 'admin';

  const [showReserve, setShowReserve] = useState(false);
  const [error, setError] = useState('');

  // Entry fade-up.
  const fadeStyle = useFadeInUp(0);

  // Count-up duration since the spot was claimed (renders inside hero).
  const elapsed = current ? elapsedSince(current.startTime) : { hours: 0, mins: 0 };
  const displayHours = useCountUp(elapsed.hours, { duration: 500, formatter: (n) => `${Math.round(n)}h` });
  const displayMins  = useCountUp(elapsed.mins,  { duration: 500, formatter: (n) => `${Math.round(n)}m` });

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

  // Sync the requester's own calendar entry when their request is resolved.
  const prevStatusMapRef = useRef<Map<string, ParkingReservationStatus>>(new Map());
  useEffect(() => {
    const prevMap = prevStatusMapRef.current;
    for (const r of reservations) {
      const prev = prevMap.get(r.id);
      if ((prev === undefined || prev === 'pending') && r.status !== 'pending' && r.requestedBy === myId) {
        if (r.status === 'approved') {
          syncParkingApproved({
            id: r.id, requestedBy: myName, date: r.date,
            startTime: r.startTime, endTime: r.endTime,
          }).catch(() => {});
        } else {
          removeCalendarEvent(`pk-${r.id}`).catch(() => {});
        }
      }
      prevMap.set(r.id, r.status);
    }
  }, [reservations, myId, myName, syncParkingApproved, removeCalendarEvent]);

  const today = todayString();
  const upcoming = useMemo(() => reservations.filter((r) => r.date >= today), [reservations, today]);
  const history  = useMemo(() => reservations.filter((r) => r.date < today),  [reservations, today]);

  const listData = useMemo((): FlatItem[] => [
    ...upcoming.map((r) => ({ _k: 'res' as const, res: r, isHistory: false })),
    ...(history.length > 0 ? [{ _k: 'hist-header' as const, count: history.length }] : []),
    ...history.map((r) => ({ _k: 'res' as const, res: r, isHistory: true })),
  ], [upcoming, history]);

  const handleClaim = useCallback(async (): Promise<void> => {
    setError(''); haptic.success();
    try { await claim(myId, myName, houseId ?? ''); }
    catch (err) { setError(err instanceof Error ? err.message : t('parking.failed_claim')); }
  }, [claim, myId, myName, houseId, t, haptic]);

  const handleRelease = useCallback(async (): Promise<void> => {
    setError(''); haptic.warn();
    try { await release(houseId ?? ''); }
    catch (err) { setError(err instanceof Error ? err.message : t('parking.failed_release')); }
  }, [release, houseId, t, haptic]);

  const handleCancel = useCallback(async (id: string): Promise<void> => {
    try {
      haptic.warn();
      await cancelReservation(id, houseId ?? '');
      removeCalendarEvent(`pk-${id}`).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_cancel'));
    }
  }, [cancelReservation, houseId, removeCalendarEvent, t, haptic]);

  const handleVote = useCallback(async (id: string, vote: ParkingVoteChoice): Promise<void> => {
    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;
    try {
      haptic.toggle();
      const resultStatus = await voteOnReservation(id, vote, houseId ?? '');
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
      setError(err instanceof Error ? err.message : t('parking.error_vote_failed'));
    }
  }, [voteOnReservation, reservations, housemates, houseId, syncParkingApproved, t, haptic]);

  const handleClear = useCallback(async (id: string): Promise<void> => {
    try { await clearHistoryItem(id); }
    catch (err) { setError(err instanceof Error ? err.message : t('parking.error_clear_failed')); }
  }, [clearHistoryItem, t]);

  const handleOpenReserve = useCallback(() => { haptic.tap(); setShowReserve(true); }, [haptic]);

  const keyExtractor = useCallback((item: FlatItem): string =>
    item._k === 'hist-header' ? 'history-header' : item.res.id, []);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<FlatItem>): React.JSX.Element => {
    if (item._k === 'hist-header') {
      return (
        <View style={styles.historyHeaderRow}>
          <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('parking.history')}</Text>
          <View style={[styles.countPill, { backgroundColor: C.secondary }]}>
            <Text style={[type.captionMed, { color: C.secondaryForeground }]}>{item.count}</Text>
          </View>
        </View>
      );
    }
    return (
      <ReservationCard
        item={item.res}
        currentUserId={myId}
        isAdmin={isAdmin}
        onCancel={handleCancel}
        onVote={handleVote}
        onClear={handleClear}
        isHistory={item.isHistory}
        C={C}
      />
    );
  }, [myId, isAdmin, handleCancel, handleVote, handleClear, t, styles, C]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={t('parking.title')} />
      <Animated.View style={[styles.flex, fadeStyle]}>
        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}

          ListHeaderComponent={
            <View>
              {/* ── Blue hero — status, occupant, claim/release ───────────── */}
              <View style={styles.heroCard}>
                <View style={styles.heroDeco} />
                <View style={styles.heroDecoSm} />

                <View style={styles.heroTopRow}>
                  <View style={[styles.heroIcon, { backgroundColor: isFree ? 'rgba(79,176,113,0.22)' : 'rgba(217,83,79,0.22)' }]}>
                    <Ionicons name={isFree ? 'car-outline' : 'car'} size={26} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.eyebrow, { color: 'rgba(255,255,255,0.78)' }]}>
                      {isFree ? t('parking.free') : t('parking.taken')}
                    </Text>
                    <Text style={[type.title, { color: '#fff' }]}>
                      {isFree
                        ? 'Spot is open'
                        : isMine
                        ? 'Your car'
                        : resolveName(current?.occupant ?? '', housemates)}
                    </Text>
                  </View>
                </View>

                <Text style={[type.bodyMd, { color: 'rgba(255,255,255,0.85)' }]}>
                  {isFree
                    ? 'Claim it before someone else does.'
                    : isMine
                    ? `Claimed at ${formatTime(current!.startTime)} · ${displayHours} ${displayMins}`
                    : `Parked since ${formatTime(current!.startTime)} · ${displayHours} ${displayMins}`}
                </Text>

                {isFree && (
                  <Button variant="primary" onPress={handleClaim} fullWidth icon="car" haptic={null}
                    style={styles.heroBtnClaim}>
                    {t('parking.claim')}
                  </Button>
                )}
                {isMine && (
                  <Button variant="secondary" onPress={handleRelease} fullWidth icon="exit-outline" haptic={null}
                    style={styles.heroBtnRelease}>
                    {t('parking.release')}
                  </Button>
                )}
                {!isFree && !isMine && isAdmin && (
                  <Button variant="secondary" onPress={handleRelease} fullWidth icon="shield-outline" haptic={null}
                    style={styles.heroBtnAdmin}>
                    {t('parking.admin_free_spot')}
                  </Button>
                )}
              </View>

              {!!error && (
                <View style={[styles.errorBox, { backgroundColor: C.danger + '15' }]}>
                  <Ionicons name="warning-outline" size={14} color={C.danger} />
                  <Text style={[type.bodySm, { color: C.danger, flex: 1 }]}>{error}</Text>
                </View>
              )}

              {/* Reservations section header */}
              <View style={styles.sectionHeader}>
                <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('parking.reservations')}</Text>
                <AddReserveBtn onPress={handleOpenReserve} label={t('parking.reserve')} C={C} />
              </View>

              {upcoming.length > 0 && (
                <View style={styles.subHeaderRow}>
                  <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('parking.upcoming')}</Text>
                  <View style={[styles.countPill, { backgroundColor: C.secondary }]}>
                    <Text style={[type.captionMed, { color: C.secondaryForeground }]}>{upcoming.length}</Text>
                  </View>
                </View>
              )}
            </View>
          }

          ListEmptyComponent={
            isLoading
              ? <EmptyState mode="loading" title="Loading…" />
              : <EmptyState
                  icon="calendar-outline"
                  title={t('parking.no_reservations')}
                  message="Reserve ahead of time so housemates know when the spot is taken."
                />
          }
        />
      </Animated.View>

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

function AddReserveBtn({ onPress, label, C }: { onPress: () => void; label: string; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.94);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: C.primary + '15',
          paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9999,
          minHeight: 36,
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name="add" size={14} color={C.primary} />
        <Text style={[type.labelSm, { color: C.primary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const makeStyles = (C: ColorTokens) => {
  const isDark = C.background !== '#F6F2EA';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    flex:      { flex: 1 },
    list:      { paddingHorizontal: sizes.md, paddingTop: 4, paddingBottom: 40 },

    // ── Hero — blue card with decoration ──────────────────────────────────
    heroCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      padding: sizes.lg, gap: 14, marginBottom: sizes.md,
      position: 'relative', overflow: 'hidden',
    },
    heroDeco: {
      position: 'absolute', top: -40, right: -30, width: 160, height: 160,
      borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)',
    },
    heroDecoSm: {
      position: 'absolute', bottom: -50, left: -20, width: 110, height: 110,
      borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    heroIcon: {
      width: 56, height: 56, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    heroBtnClaim:   { backgroundColor: C.positive, shadowColor: C.positive, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 } as never,
    heroBtnRelease: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.28)', borderWidth: 1 } as never,
    heroBtnAdmin:   { backgroundColor: 'rgba(224,178,77,0.18)', borderColor: 'rgba(224,178,77,0.42)', borderWidth: 1 } as never,

    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 4, marginBottom: 12,
    },
    subHeaderRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 4, marginBottom: 12,
    },
    countPill: {
      minHeight: 22, paddingHorizontal: 8, borderRadius: 9999,
      justifyContent: 'center', alignItems: 'center',
    },

    historyHeaderRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 4, paddingTop: 16, paddingBottom: 8,
    },

    // ── Reservation card ──────────────────────────────────────────────────
    resCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      paddingHorizontal: 14, paddingVertical: 14,
      borderRadius: 14, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      ...(isDark
        ? {}
        : {
            shadowColor: '#2C333D', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.02, shadowRadius: 16, elevation: 1,
          }),
    } as never,
    resCardDim: { opacity: 0.72 },
    resIconWrap: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: C.surfaceSecondary,
      justifyContent: 'center', alignItems: 'center', flexShrink: 0,
      marginTop: 2,
    },
    resInfo:    { flex: 1, gap: 4 },
    resActions: { gap: 6, alignItems: 'center', paddingTop: 2 },

    // Vote row
    voteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    voteAvatarWrap: { position: 'relative', width: 28, height: 28 },
    voteAvatarCircle: {
      width: 28, height: 28, borderRadius: 14,
      justifyContent: 'center', alignItems: 'center',
    },
    voteDot: {
      position: 'absolute', bottom: -1, right: -1,
      width: 13, height: 13, borderRadius: 7,
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1.5, borderColor: C.surface,
    },
    dotApprove: { backgroundColor: C.positive },
    dotReject:  { backgroundColor: C.danger },
    dotPending: { backgroundColor: C.textSecondary + '80' },

    voteBtns: { flexDirection: 'row', gap: 6 },

    // Error banner
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: 10, padding: 12, marginBottom: 16,
    },

    // ── Reserve modal ─────────────────────────────────────────────────────
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24,
      padding: 24, paddingBottom: 40, gap: 12,
      maxHeight: '90%',
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 4 },
    fieldLabel:  { marginBottom: 6, textTransform: 'none' as const, letterSpacing: 0 },
    fieldInput: {
      borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: C.textPrimary,
      backgroundColor: C.surfaceSecondary,
    },
    conflictBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    modalBtns:   { flexDirection: 'row', gap: 10, marginTop: 8 },
  });
};
