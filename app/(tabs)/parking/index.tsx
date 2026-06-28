import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Platform,
  AppState,
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
  isReservationPastDue,
  isVoteChangeLocked,
  type ConflictResult,
  type ParkingReservation,
  type ParkingReservationStatus,
  type ParkingSession,
  type ParkingVote,
  type ParkingVoteChoice,
} from '@stores/parkingStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore, type Housemate } from '@stores/housematesStore';
import { resolveName } from '@utils/housemates';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useLanguageStore } from '@stores/languageStore';
import { CalendarPicker } from '@components/shared/CalendarPicker';
import { TimePicker } from '@components/shared/TimePicker';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { EmptyState } from '@components/ui';
import { font } from '@constants/typography';

function formatTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function parseDateParts(
  dateStr: string,
  locale: string
): {
  dayNum: string;
  monthAbbr: string;
  weekdayFull: string;
} {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    dayNum: String(d),
    monthAbbr: date.toLocaleString(locale, { month: 'short' }).toUpperCase(),
    weekdayFull: date.toLocaleString(locale, { weekday: 'long' }),
  };
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Component prop interfaces ──────────────────────────────────────────────────
export interface VoteRowProps {
  votes: ParkingVote[];
  housemates: Housemate[];
  requestedBy: string;
  votingClosed?: boolean;
}

export interface ReservationCardProps {
  item: ParkingReservation;
  currentUserId: string;
  isAdmin: boolean;
  onCancel: (id: string) => void;
  onVote: (id: string, vote: ParkingVoteChoice) => void;
  onClear: (id: string) => void;
  onDatePress: (date: string) => void;
  isHistory: boolean;
  now: Date;
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
function VoteRow({
  votes,
  housemates,
  requestedBy,
  votingClosed = false,
}: VoteRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const voters = housemates.filter((h) => h.id !== requestedBy);
  if (voters.length === 0) return <View />;

  const hasPendingVoters =
    !votingClosed && voters.some((h) => !votes.find((v) => v.userId === h.id));

  return (
    <View style={styles.voteRowWrapper}>
      <View style={styles.voteRow}>
        {voters.map((h) => {
          const v = votes.find((vote) => vote.userId === h.id);
          const dotStyle =
            v?.vote === 'approve'
              ? styles.dotApprove
              : v?.vote === 'reject'
                ? styles.dotReject
                : styles.dotPending;
          const dotIcon =
            v?.vote === 'approve' ? 'checkmark' : v?.vote === 'reject' ? 'close' : 'remove';
          return (
            <View key={h.id} style={styles.voteAvatarWrap}>
              <View style={[styles.voteAvatarCircle, { backgroundColor: h.color + '30' }]}>
                <Text style={[styles.voteAvatarInitial, { color: h.color }]}>
                  {h.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={[styles.voteDot, dotStyle]}>
                <Ionicons
                  name={dotIcon as 'checkmark' | 'close' | 'remove'}
                  size={7}
                  color="#fff"
                />
              </View>
            </View>
          );
        })}
      </View>
      {hasPendingVoters && (
        <View style={styles.voteAbstainNote} accessibilityRole="text">
          <Ionicons name="information-circle-outline" size={10} color={C.textSecondary} />
          <Text style={styles.voteAbstainText}>{t('parking.abstain_note')}</Text>
        </View>
      )}
    </View>
  );
}

// ── Day schedule sheet ────────────────────────────────────────────────────────
interface DayScheduleSheetProps {
  date: string | null;
  onClose: () => void;
  currentUserId: string;
  now: Date;
}

function DayScheduleSheet({
  date,
  onClose,
  currentUserId,
  now,
}: DayScheduleSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);
  const allReservations = useParkingStore((s) => s.reservations);

  const dayReservations = useMemo(() => {
    if (!date) return [];
    return [...allReservations]
      .filter((r) => r.date === date)
      .sort((a, b) => {
        if (!a.startTime && !b.startTime) return 0;
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [allReservations, date]);

  if (!date) return <View />;
  const { dayNum, monthAbbr, weekdayFull } = parseDateParts(date, language);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.daySheetBackdrop} onPress={onClose}>
        <Pressable style={styles.daySheetPanel} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.daySheetTitle}>
            {weekdayFull}, {dayNum} {monthAbbr}
          </Text>

          {dayReservations.length === 0 ? (
            <Text style={styles.daySheetEmpty}>{t('parking.no_reservations_day')}</Text>
          ) : (
            <View style={styles.daySheetList}>
              {dayReservations.map((r) => {
                const isOwn = r.requestedBy === currentUserId;
                const dotColor =
                  r.status === 'approved'
                    ? C.positive
                    : r.status === 'rejected'
                      ? C.danger
                      : C.warning;
                const statusBg =
                  r.status === 'approved'
                    ? C.positive + '20'
                    : r.status === 'rejected'
                      ? C.danger + '15'
                      : C.warning + '20';
                const votingClosed =
                  r.status === 'pending' && isReservationPastDue(r.date, r.startTime, now);
                const statusLabel =
                  r.status === 'approved'
                    ? t('parking.approved')
                    : r.status === 'rejected'
                      ? t('parking.rejected')
                      : votingClosed
                        ? t('parking.voting_closed')
                        : t('parking.pending');
                const timeLabel = r.startTime
                  ? `${r.startTime}${r.endTime ? ` – ${r.endTime}` : ''}`
                  : t('parking.all_day');
                return (
                  <View key={r.id} style={styles.daySheetRow}>
                    <View style={[styles.daySheetDot, { backgroundColor: dotColor }]} />
                    <View style={styles.daySheetRowInfo}>
                      <Text style={styles.daySheetTime}>{timeLabel}</Text>
                      <Text style={styles.daySheetName}>
                        {isOwn ? t('parking.you') : resolveName(r.requestedBy, housemates)}
                        {r.note ? ` · ${r.note}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.daySheetStatusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[styles.daySheetStatusText, { color: dotColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <Pressable
            style={styles.daySheetCloseBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text style={styles.daySheetCloseBtnText}>{t('common.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Reservation card ───────────────────────────────────────────────────────────
function ReservationCard({
  item,
  currentUserId,
  isAdmin,
  onCancel,
  onVote,
  onClear,
  onDatePress,
  isHistory,
  now,
}: ReservationCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);
  const allReservations = useParkingStore((s) => s.reservations);
  const sameDayDots = useMemo(
    () =>
      allReservations
        .filter((r) => r.date === item.date)
        .sort((a, b) => {
          if (!a.startTime && !b.startTime) return 0;
          if (!a.startTime) return 1;
          if (!b.startTime) return -1;
          return a.startTime.localeCompare(b.startTime);
        })
        .slice(0, 4),
    [allReservations, item.date]
  );
  const isOwn = item.requestedBy === currentUserId;
  const isPending = item.status === 'pending';
  const approved = item.status === 'approved';
  const rejected = item.status === 'rejected';
  const votingClosed = isPending && isReservationPastDue(item.date, item.startTime, now);

  const statusColor = approved ? C.positive : rejected ? C.danger : C.warning;
  const statusBg = approved ? C.positive + '20' : rejected ? C.danger + '15' : C.warning + '20';
  const statusLabel = approved
    ? t('parking.approved')
    : rejected
      ? t('parking.rejected')
      : votingClosed
        ? t('parking.voting_closed')
        : t('parking.pending');

  const handleCancel = useCallback(() => onCancel(item.id), [onCancel, item.id]);
  const handleClear = useCallback(() => onClear(item.id), [onClear, item.id]);
  const handleApprove = useCallback(() => onVote(item.id, 'approve'), [onVote, item.id]);
  const handleReject = useCallback(() => onVote(item.id, 'reject'), [onVote, item.id]);

  const timeText = item.startTime
    ? `${item.startTime}${item.endTime ? ` – ${item.endTime}` : ''}`
    : null;

  const { dayNum, monthAbbr, weekdayFull } = parseDateParts(item.date, language);
  const handleDatePress = useCallback(() => onDatePress(item.date), [onDatePress, item.date]);

  const myVote = item.votes.find((v) => v.userId === currentUserId);
  // Within the lock window, voters can't change their mind but non-voters can still cast a vote
  const voteChangeLocked =
    isPending && !votingClosed && isVoteChangeLocked(item.date, item.startTime, now);
  const canVote = !isOwn && isPending && !votingClosed && !(myVote && voteChangeLocked);
  // Admin can cancel any upcoming (non-history) reservation they don't own
  const canAdminCancel = isAdmin && !isOwn && !isHistory && (isPending || approved);
  const showOwnCancel = isOwn && isPending;

  return (
    <View style={[styles.resCard, isHistory && styles.resCardDim]}>
      <View style={styles.dateBadgeCol}>
        <Pressable
          style={[styles.dateBadge, { borderColor: statusColor + '50' }]}
          onPress={handleDatePress}
          hitSlop={{ top: 4, bottom: 0, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={t('parking.tap_see_day_schedule', { weekday: weekdayFull, day: dayNum, month: monthAbbr })}
        >
          <View style={[styles.dateBadgeTop, { backgroundColor: statusColor }]}>
            <Text style={styles.dateBadgeMonth}>{monthAbbr}</Text>
          </View>
          <View style={styles.dateBadgeBottom}>
            <Text style={[styles.dateBadgeDay, { color: C.textPrimary }]}>{dayNum}</Text>
            {sameDayDots.length > 1 && (
              <View style={styles.dayDots}>
                {sameDayDots.map((r) => (
                  <View
                    key={r.id}
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor:
                          r.status === 'approved'
                            ? C.positive
                            : r.status === 'rejected'
                              ? C.danger
                              : C.warning,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </Pressable>
        <Text style={[styles.dateBadgeWeekLabel, { color: C.textSecondary }]}>{weekdayFull}</Text>
      </View>

      <View style={styles.resInfo}>
        {!!timeText && <Text style={styles.resDate}>{timeText}</Text>}
        <Text style={styles.resBy}>
          {isOwn ? t('parking.you') : resolveName(item.requestedBy, housemates)}
          {item.note ? ` · ${item.note}` : ''}
        </Text>

        <VoteRow
          votes={item.votes}
          housemates={housemates}
          requestedBy={item.requestedBy}
          votingClosed={votingClosed}
        />

        <View style={[styles.badge, { backgroundColor: statusBg }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={styles.resActions}>
        {showOwnCancel && (
          <Pressable
            onPress={handleCancel}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('parking.cancel_reservation')}
          >
            <Ionicons name="close-circle-outline" size={20} color={C.danger} />
          </Pressable>
        )}

        {canAdminCancel && (
          <Pressable
            onPress={handleCancel}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('parking.admin_cancel_reservation')}
          >
            <Ionicons name="shield-outline" size={20} color={C.warning} />
          </Pressable>
        )}

        {isHistory && (
          <Pressable
            onPress={handleClear}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('parking.clear_from_history')}
          >
            <Ionicons name="trash-outline" size={18} color={C.textSecondary} />
          </Pressable>
        )}

        {canVote && (
          <View style={styles.voteBtns}>
            <Pressable
              onPress={handleApprove}
              style={[styles.voteBtn, myVote?.vote === 'approve' && styles.voteBtnApproveActive]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('parking.approve_request')}
              accessibilityState={{ selected: myVote?.vote === 'approve' }}
            >
              <Ionicons
                name="checkmark"
                size={15}
                color={myVote?.vote === 'approve' ? '#fff' : C.positive}
              />
            </Pressable>
            <Pressable
              onPress={handleReject}
              style={[styles.voteBtn, myVote?.vote === 'reject' && styles.voteBtnRejectActive]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('parking.reject_request')}
              accessibilityState={{ selected: myVote?.vote === 'reject' }}
            >
              <Ionicons
                name="close"
                size={15}
                color={myVote?.vote === 'reject' ? '#fff' : C.danger}
              />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Week strip ────────────────────────────────────────────────────────────────
interface WeekStripProps {
  onDayPress: (date: string) => void;
}

function WeekStrip({ onDayPress }: WeekStripProps): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const language = useLanguageStore((s) => s.language);
  const allReservations = useParkingStore((s) => s.reservations);

  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayAbbr = d.toLocaleString(language, { weekday: 'short' }).toUpperCase();
      const dots = allReservations
        .filter((r) => r.date === dateStr)
        .sort((a, b) => {
          if (!a.startTime && !b.startTime) return 0;
          if (!a.startTime) return 1;
          if (!b.startTime) return -1;
          return a.startTime.localeCompare(b.startTime);
        })
        .slice(0, 3);
      return { dateStr, dayAbbr, dayNum: d.getDate(), isToday: i === 0, dots };
    });
  }, [language, allReservations]);

  return (
    <View style={styles.weekStrip}>
      {days.map(({ dateStr, dayAbbr, dayNum, isToday, dots }) => (
        <Pressable
          key={dateStr}
          style={styles.weekDay}
          onPress={() => onDayPress(dateStr)}
          hitSlop={{ left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`${dayAbbr} ${dayNum}`}
        >
          <Text style={[styles.weekDayAbbr, isToday && styles.weekDayAbbrToday]}>{dayAbbr}</Text>
          <View style={[styles.weekDayNumWrap, isToday && styles.weekDayNumWrapToday]}>
            <Text style={[styles.weekDayNum, isToday && styles.weekDayNumToday]}>{dayNum}</Text>
          </View>
          <View style={styles.weekDayDots}>
            {dots.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.weekDot,
                  {
                    backgroundColor:
                      r.status === 'approved'
                        ? C.positive
                        : r.status === 'rejected'
                          ? C.danger
                          : C.warning,
                  },
                ]}
              />
            ))}
          </View>
        </Pressable>
      ))}
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
}: ReserveModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
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
      ? current.occupant === myId
        ? t('parking.currently_using_you')
        : t('parking.currently_using_other', { name: resolveName(current.occupant, housemates, t('common.unknown')) })
      : null;
  const conflictResult: ConflictResult = isDateConflict(
    date,
    startTime || undefined,
    endTime || undefined,
    reservations,
    (id: string): string => resolveName(id, housemates, t('common.unknown'))
  );
  const dateConflict = conflictResult.conflict;
  const dateWarning = conflictResult.warning;

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
    if (dateConflict) {
      setError(dateConflict);
      return;
    }
    if (!!startTime !== !!endTime) {
      setError(t('parking.error_both_times'));
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      setError(t('parking.error_end_before_start'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const reservationId = await addReservation(
        {
          requestedBy: myId,
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          note,
        },
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
      setError(t('parking.failed_reservation'));
    } finally {
      setSaving(false);
    }
  }, [
    dateConflict,
    date,
    startTime,
    endTime,
    note,
    myId,
    myName,
    houseId,
    addReservation,
    handleClose,
    syncParkingPending,
    t,
  ]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('parking.reserve_parking')}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
            <Text style={styles.fieldLabel}>{t('parking.date')}</Text>
            <CalendarPicker
              value={date}
              onChange={(d) => {
                setDate(d);
                setError('');
              }}
            />

            {!!dateConflict && (
              <View style={styles.conflictBox}>
                <Ionicons name="warning-outline" size={13} color={C.warning} />
                <Text style={styles.conflictText}>{dateConflict}</Text>
              </View>
            )}
            {!dateConflict && !!dateWarning && (
              <View style={[styles.conflictBox, styles.conflictWarningBox]}>
                <Ionicons name="time-outline" size={13} color={C.warning} />
                <Text style={[styles.conflictText, styles.conflictWarningText]}>{dateWarning}</Text>
              </View>
            )}
            {!dateConflict && !!activeConflict && (
              <View style={[styles.conflictBox, styles.conflictWarningBox]}>
                <Ionicons name="information-circle-outline" size={13} color={C.warning} />
                <Text style={[styles.conflictText, styles.conflictWarningText]}>
                  {activeConflict}
                </Text>
              </View>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('parking.start_time')}</Text>
            <TimePicker value={startTime} onChange={setStartTime} />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('parking.end_time')}</Text>
            <TimePicker value={endTime} onChange={setEndTime} />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>{t('parking.note_label')}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={styles.fieldInput}
              placeholder={t('parking.note_placeholder')}
              placeholderTextColor={C.textSecondary}
            />

            {!!error && <Text style={styles.fieldError}>{error}</Text>}
          </ScrollView>

          <View style={styles.modalBtns}>
            <Pressable
              style={styles.modalBtnOutline}
              onPress={handleClose}
              accessibilityRole="button"
            >
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
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const isLoading = useParkingStore((s) => s.isLoading);
  const current = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const claim = useParkingStore((s) => s.claim);
  const release = useParkingStore((s) => s.release);
  const cancelReservation = useParkingStore((s) => s.cancelReservation);
  const voteOnReservation = useParkingStore((s) => s.voteOnReservation);
  const clearHistoryItem = useParkingStore((s) => s.clearHistoryItem);
  const clearAllHistory = useParkingStore((s) => s.clearAllHistory);
  const checkReservationAutoApply = useParkingStore((s) => s.checkReservationAutoApply);

  const language = useLanguageStore((s) => s.language);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);
  const housemates = useHousematesStore((s) => s.housemates);
  const syncParkingApproved = useCalendarSyncStore((s) => s.syncParkingApproved);
  const removeCalendarEvent = useCalendarSyncStore((s) => s.removeCalendarEvent);

  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const isMine = current?.occupant === myId;
  const isFree = !current;
  const isAdmin = role === 'owner' || role === 'admin';

  const [showReserve, setShowReserve] = useState(false);
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  const handleDatePress = useCallback((date: string) => setDaySheetDate(date), []);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (!houseId) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        checkReservationAutoApply(houseId);
        setNow(new Date());
      }
      appStateRef.current = nextState;
    });
    const interval = setInterval(() => {
      checkReservationAutoApply(houseId ?? '');
      setNow(new Date());
    }, 60_000);
    return (): void => {
      sub.remove();
      clearInterval(interval);
    };
  }, [houseId, checkReservationAutoApply]);

  // Sync the requester's own calendar entry when their request is resolved.
  // Voters already call syncParkingApproved in handleVote; this effect handles
  // the requester's device where the status change arrives via realtime.
  const prevStatusMapRef = useRef<Map<string, ParkingReservationStatus>>(new Map());
  useEffect(() => {
    const prevMap = prevStatusMapRef.current;
    for (const r of reservations) {
      const prev = prevMap.get(r.id);
      if (
        (prev === undefined || prev === 'pending') &&
        r.status !== 'pending' &&
        r.requestedBy === myId
      ) {
        if (r.status === 'approved') {
          syncParkingApproved({
            id: r.id,
            requestedBy: myName,
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime,
          }).catch(() => {});
        } else {
          removeCalendarEvent(`pk-${r.id}`).catch(() => {});
        }
      }
      prevMap.set(r.id, r.status);
    }
  }, [reservations, myId, myName, syncParkingApproved, removeCalendarEvent]);

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
      await release(houseId ?? '', myName);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_release'));
    }
  }, [release, houseId, myName, t]);

  const handleReleaseOther = useCallback((): void => {
    const pinnedSessionId = current?.id ?? '';
    const occupantName = resolveName(current?.occupant ?? '', housemates, t('common.unknown'));
    const pinnedHouseId = houseId ?? '';

    const doRelease = (): void => {
      if (useParkingStore.getState().current?.id !== pinnedSessionId) {
        if (Platform.OS === 'web') {
          window.alert(t('parking.spot_changed'));
        } else {
          Alert.alert(
            t('parking.could_not_free'),
            t('parking.spot_changed')
          );
        }
        return;
      }
      release(pinnedHouseId, myName).catch(() => {
        const msg = t('parking.failed_release');
        if (Platform.OS === 'web') {
          window.alert(msg);
        } else {
          Alert.alert(t('parking.could_not_free'), msg);
        }
      });
    };

    if (Platform.OS === 'web') {
      if (
        window.confirm(t('parking.evict_confirm', { name: occupantName }))
      ) {
        doRelease();
      }
    } else {
      Alert.alert(
        t('parking.kick_out_title', { name: occupantName }),
        t('parking.kick_out_body'),
        [
          { text: t('parking.leave_it'), style: 'cancel' },
          { text: t('parking.free_it_anyway'), style: 'destructive', onPress: doRelease },
        ]
      );
    }
  }, [current, housemates, myName, release, houseId, t]);

  const handleCancel = useCallback(
    async (id: string): Promise<void> => {
      try {
        await cancelReservation(id, houseId ?? '');
        removeCalendarEvent(`pk-${id}`).catch(() => {});
      } catch (err) {
        setError(err instanceof Error ? err.message : t('parking.failed_cancel'));
      }
    },
    [cancelReservation, houseId, removeCalendarEvent, t]
  );

  const handleVote = useCallback(
    async (id: string, vote: ParkingVoteChoice): Promise<void> => {
      const reservation = reservations.find((r) => r.id === id);
      if (!reservation) return;
      try {
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
    },
    [voteOnReservation, reservations, housemates, houseId, syncParkingApproved, t]
  );

  const handleClear = useCallback(
    async (id: string): Promise<void> => {
      try {
        await clearHistoryItem(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('parking.error_clear_failed'));
      }
    },
    [clearHistoryItem, t]
  );

  const handleClearAll = useCallback((): void => {
    const doDelete = (): void => {
      clearAllHistory(houseId ?? '').catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t('parking.error_clear_all_failed'));
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('parking.clear_all_confirm_msg'))) doDelete();
    } else {
      Alert.alert(t('parking.clear_all_confirm_title'), t('parking.clear_all_confirm_msg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('parking.clear_all'), style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [clearAllHistory, houseId, t]);

  const keyExtractor = useCallback(
    (item: FlatItem): string => (item._k === 'hist-header' ? 'history-header' : item.res.id),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<FlatItem>): React.JSX.Element => {
      if (item._k === 'hist-header') {
        return (
          <View style={styles.historyHeaderRow}>
            <Text style={styles.eyebrow}>{t('parking.history')}</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{item.count}</Text>
            </View>
            <View style={styles.historyHeaderSpacer} />
            <Pressable
              onPress={handleClearAll}
              style={styles.clearAllBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('parking.clear_all_history')}
            >
              <Ionicons name="trash-outline" size={12} color={C.danger} />
              <Text style={styles.clearAllBtnText}>{t('parking.clear_all')}</Text>
            </Pressable>
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
          onDatePress={handleDatePress}
          isHistory={item.isHistory}
          now={now}
        />
      );
    },
    [
      myId,
      isAdmin,
      handleCancel,
      handleVote,
      handleClear,
      handleDatePress,
      handleClearAll,
      now,
      C,
      t,
      styles,
    ]
  );

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
                    ? t('parking.free_real_estate')
                    : isMine
                      ? current!.startTime
                        ? t('parking.your_car_since', { time: formatTime(current!.startTime, language) })
                        : t('parking.your_car_all_day')
                      : current!.startTime
                        ? t('parking.took_spot_since', { name: resolveName(current?.occupant ?? '', housemates, t('common.unknown')), time: formatTime(current!.startTime, language) })
                        : t('parking.took_spot_all_day', { name: resolveName(current?.occupant ?? '', housemates, t('common.unknown')) })}
                </Text>
              </View>

              <View
                style={[
                  styles.statusCircle,
                  { backgroundColor: isFree ? C.positive + '18' : C.negative + '18' },
                ]}
              >
                <Ionicons
                  name={isFree ? 'car-outline' : 'car'}
                  size={38}
                  color={isFree ? C.positive : C.negative}
                />
                <Text style={[styles.statusLabel, { color: isFree ? C.positive : C.negative }]}>
                  {isFree ? t('parking.free') : t('parking.taken')}
                </Text>
              </View>

              {isFree && (
                <Pressable
                  style={styles.btnPrimary}
                  onPress={handleClaim}
                  accessibilityRole="button"
                >
                  <Ionicons name="car" size={16} color="#fff" style={styles.btnIcon} />
                  <Text style={styles.btnPrimaryText}>{t('parking.claim')}</Text>
                </Pressable>
              )}
              {isMine && (
                <Pressable
                  style={styles.btnDanger}
                  onPress={handleRelease}
                  accessibilityRole="button"
                >
                  <Ionicons name="exit-outline" size={16} color={C.danger} style={styles.btnIcon} />
                  <Text style={styles.btnDangerText}>{t('parking.release')}</Text>
                </Pressable>
              )}
              {!isFree && !isMine && (
                <Pressable
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('parking.free_the_spot')}
                  accessibilityState={{ disabled: false }}
                  style={styles.btnAdminRelease}
                  onPress={handleReleaseOther}
                >
                  <Ionicons
                    name="exit-outline"
                    size={15}
                    color={C.warning}
                    style={styles.btnIcon}
                  />
                  <Text style={styles.btnAdminReleaseText}>{t('parking.admin_free_spot')}</Text>
                </Pressable>
              )}
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={14} color={C.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <WeekStrip onDayPress={handleDatePress} />

            {/* ── Reservations section header ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.eyebrow}>{t('parking.reservations')}</Text>
              <Pressable
                onPress={() => setShowReserve(true)}
                style={styles.addBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={14} color={C.primary} />
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
          isLoading ? (
            <EmptyState mode="loading" title={t('common.loading')} />
          ) : (
            <EmptyState
              icon="calendar-outline"
              title={t('parking.no_reservations')}
              message={t('parking.no_reservations_hint')}
            />
          )
        }
      />

      <DayScheduleSheet
        date={daySheetDate}
        onClose={() => setDaySheetDate(null)}
        currentUserId={myId}
        now={now}
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

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
    sep: { height: 8 },

    heroCard: {
      backgroundColor: C.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      padding: 20,
      gap: 16,
      marginBottom: 24,
      shadowColor: '#2C333D',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.05,
      shadowRadius: 24,
      elevation: 3,
    },
    heroCopy: { gap: 6 },
    titleHero: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.78 },
    textBase: { fontSize: 15, ...font.regular, color: C.textSecondary, lineHeight: 22 },

    statusCircle: {
      alignSelf: 'center',
      width: 96,
      height: 96,
      borderRadius: 48,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
    },
    statusLabel: { fontSize: 12, ...font.bold, letterSpacing: 0.6 },

    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: C.primary,
      shadowColor: '#4F78B6',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
      elevation: 6,
    },
    btnDanger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: C.danger + '15',
      borderWidth: 1,
      borderColor: C.danger + '30',
    },
    btnAdminRelease: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: C.warning + '15',
      borderWidth: 1,
      borderColor: C.warning + '40',
    },
    btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
    btnDangerText: { fontSize: 15, ...font.semibold, color: C.danger },
    btnAdminReleaseText: { fontSize: 14, ...font.semibold, color: C.warning },
    btnIcon: { marginEnd: 6 },

    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.primary + '15',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 9999,
    },
    addBtnText: { fontSize: 13, ...font.semibold, color: C.primary },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    subHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
      marginBottom: 12,
    },
    eyebrow: {
      fontSize: 12,
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.72,
      textTransform: 'uppercase',
    },
    countPill: {
      minHeight: 22,
      paddingHorizontal: 8,
      borderRadius: 9999,
      backgroundColor: C.secondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    countPillText: { fontSize: 11, ...font.bold, color: C.secondaryForeground },

    historyHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
      paddingTop: 16,
      paddingBottom: 8,
    },

    resCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#2C333D',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.02,
      shadowRadius: 16,
      elevation: 1,
    },
    resCardDim: { opacity: 0.72 },
    dateBadgeCol: { alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
    dateBadge: {
      width: 52,
      borderRadius: 10,
      overflow: 'hidden',
      borderWidth: 1,
      flexShrink: 0,
    },
    dateBadgeTop: { paddingVertical: 4, alignItems: 'center' },
    dateBadgeMonth: { fontSize: 9, ...font.bold, color: '#fff', letterSpacing: 0.6 },
    dateBadgeBottom: {
      backgroundColor: C.surfaceSecondary,
      alignItems: 'center',
      paddingTop: 5,
      paddingBottom: 7,
    },
    dateBadgeDay: { fontSize: 22, ...font.extrabold, lineHeight: 26, letterSpacing: -0.5 },
    dateBadgeWeekLabel: { fontSize: 10, ...font.medium, textAlign: 'center' },
    dayDots: { flexDirection: 'row', gap: 3, justifyContent: 'center', marginTop: 4 },
    dayDot: { width: 5, height: 5, borderRadius: 3 },
    resInfo: { flex: 1, gap: 4 },
    resDate: { fontSize: 13, ...font.semibold, color: C.textSecondary },
    resBy: { fontSize: 13, ...font.regular, color: C.textSecondary },

    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 9999,
      marginTop: 2,
    },
    badgeText: { fontSize: 11, ...font.semibold },

    resActions: { gap: 6, alignItems: 'center', paddingTop: 2 },
    iconBtn: { padding: 4 },

    voteRowWrapper: { marginTop: 2, gap: 3 },
    voteRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    voteAbstainNote: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    voteAbstainText: { fontSize: 10, ...font.regular, color: C.textSecondary, flex: 1 },
    voteAvatarWrap: { position: 'relative', width: 28, height: 28 },
    voteAvatarCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    voteAvatarInitial: { fontSize: 11, ...font.bold },
    voteDot: {
      position: 'absolute',
      bottom: -1,
      right: -1,
      width: 13,
      height: 13,
      borderRadius: 7,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: C.surface,
    },
    dotApprove: { backgroundColor: C.positive },
    dotReject: { backgroundColor: C.danger },
    dotPending: { backgroundColor: C.textSecondary + '80' },

    voteBtns: { flexDirection: 'row', gap: 6 },
    voteBtn: {
      width: 32,
      height: 32,
      borderRadius: 9999,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    voteBtnApproveActive: { backgroundColor: C.positive, borderColor: C.positive },
    voteBtnRejectActive: { backgroundColor: C.danger, borderColor: C.danger },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
    },
    errorText: { fontSize: 13, ...font.regular, color: C.danger, flex: 1 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      gap: 12,
      maxHeight: '90%',
    },
    modalScroll: { flexGrow: 0 },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.border,
      alignSelf: 'center',
      marginBottom: 4,
    },
    modalTitle: { fontSize: 20, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    fieldLabel: { fontSize: 13, ...font.semibold, color: C.textPrimary, marginBottom: 6 },
    fieldInput: {
      borderWidth: 1.5,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      ...font.regular,
      color: C.textPrimary,
      backgroundColor: C.surfaceSecondary,
    },
    fieldError: { fontSize: 13, ...font.regular, color: C.negative },
    conflictBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    conflictText: { fontSize: 13, ...font.medium, color: C.warning, flex: 1 },
    conflictWarningBox: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 8,
      borderColor: C.warning + '40',
      backgroundColor: C.warning + '10',
    },
    conflictWarningText: { color: C.warning },
    modalBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
    modalBtnOutline: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
    },
    modalBtnOutlineText: { fontSize: 15, ...font.semibold, color: C.textPrimary },
    modalBtnPrimary: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: C.primary,
      alignItems: 'center',
    },
    modalBtnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },

    daySheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    daySheetPanel: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
      gap: 16,
    },
    daySheetTitle: { fontSize: 20, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },
    daySheetEmpty: {
      fontSize: 14,
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingVertical: 16,
    },
    daySheetList: { gap: 10 },
    daySheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
    },
    daySheetDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    daySheetRowInfo: { flex: 1, gap: 2 },
    daySheetTime: { fontSize: 13, ...font.semibold, color: C.textPrimary },
    daySheetName: { fontSize: 12, ...font.regular, color: C.textSecondary },
    daySheetStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 9999,
      flexShrink: 0,
    },
    daySheetStatusText: { fontSize: 11, ...font.semibold },
    daySheetCloseBtn: {
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: C.border,
      alignItems: 'center',
    },
    daySheetCloseBtnText: { fontSize: 15, ...font.semibold, color: C.textPrimary },

    weekStrip: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 12,
      paddingHorizontal: 4,
      marginBottom: 16,
    },
    weekDay: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
      paddingVertical: 2,
    },
    weekDayAbbr: {
      fontSize: 9,
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.4,
    },
    weekDayAbbrToday: { color: C.primary },
    weekDayNumWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    weekDayNumWrapToday: { backgroundColor: C.primary },
    weekDayNum: { fontSize: 14, ...font.bold, color: C.textPrimary },
    weekDayNumToday: { color: '#fff' },
    weekDayDots: {
      flexDirection: 'row',
      gap: 2,
      height: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekDot: { width: 5, height: 5, borderRadius: 3 },

    historyHeaderSpacer: { flex: 1 },
    clearAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 44,
      paddingHorizontal: 10,
      borderRadius: 9999,
      backgroundColor: C.danger + '12',
    },
    clearAllBtnText: { fontSize: 11, ...font.semibold, color: C.danger },
  });
