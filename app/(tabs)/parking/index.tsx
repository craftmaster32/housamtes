import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput, Modal, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useParkingStore, isDateConflict, type ParkingReservation } from '@stores/parkingStore';
import { useAuthStore } from '@stores/authStore';
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

function ReservationCard({
  item,
  currentUser,
  onCancel,
  onApprove,
  houseId,
}: {
  item: ParkingReservation;
  currentUser: string;
  onCancel: (id: string) => void;
  onApprove: (id: string, houseId: string) => void;
  houseId: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const isOwn    = item.requestedBy === currentUser;
  const approved = item.status === 'approved';

  const timeLabel = item.startTime
    ? ` · ${item.startTime}${item.endTime ? `–${item.endTime}` : ''}`
    : '';

  return (
    <View style={styles.resCard}>
      <View style={styles.resIconWrap}>
        <Ionicons name="calendar-outline" size={18} color={approved ? colors.positive : colors.warning} />
      </View>
      <View style={styles.resInfo}>
        <Text style={styles.resDate}>{formatDate(item.date)}{timeLabel}</Text>
        <Text style={styles.resBy}>
          {isOwn ? 'You' : item.requestedBy}
          {item.note ? ` · ${item.note}` : ''}
        </Text>
        <View style={[styles.badge, approved ? styles.badgeGreen : styles.badgeYellow]}>
          <Text style={[styles.badgeText, { color: approved ? colors.positive : colors.warning }]}>
            {approved ? t('parking.approved') : t('parking.pending')}
          </Text>
        </View>
      </View>
      <View style={styles.resActions}>
        {isOwn && (
          <Pressable onPress={() => onCancel(item.id)} style={styles.cancelBtn} accessibilityRole="button">
            <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
          </Pressable>
        )}
        {!isOwn && item.status === 'pending' && (
          <Pressable onPress={() => onApprove(item.id, houseId)} style={styles.approveBtn} accessibilityRole="button">
            <Text style={styles.approveBtnText}>{t('parking.approve')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Reserve modal ──────────────────────────────────────────────────────────────
function ReserveModal({
  visible,
  onClose,
  myName,
  houseId,
  reservations,
}: {
  visible: boolean;
  onClose: () => void;
  myName: string;
  houseId: string;
  reservations: ParkingReservation[];
}): React.JSX.Element {
  const { t } = useTranslation();
  const addReservation = useParkingStore((s) => s.addReservation);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const [date, setDate]           = useState(todayStr);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');
  const [note, setNote]           = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const dateConflict = isDateConflict(date, reservations);

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
      await addReservation(
        { requestedBy: myName, date, startTime: startTime || undefined, endTime: endTime || undefined, note },
        houseId
      );
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_reservation'));
    } finally {
      setSaving(false);
    }
  }, [dateConflict, date, startTime, endTime, note, myName, houseId, addReservation, handleClose, t]);

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

// ── Main screen ────────────────────────────────────────────────────────────────
export default function ParkingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const current            = useParkingStore((s) => s.current);
  const reservations       = useParkingStore((s) => s.reservations);
  const claim              = useParkingStore((s) => s.claim);
  const release            = useParkingStore((s) => s.release);
  const cancelReservation  = useParkingStore((s) => s.cancelReservation);
  const approveReservation = useParkingStore((s) => s.approveReservation);

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);

  const myName  = profile?.name ?? '';
  const isMine  = current?.occupant === myName;
  const isFree  = !current;

  const [showReserve, setShowReserve] = useState(false);
  const [error, setError]             = useState('');

  const handleClaim = useCallback(async (): Promise<void> => {
    setError('');
    try {
      await claim(myName, houseId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_claim'));
    }
  }, [claim, myName, houseId, t]);

  const handleRelease = useCallback(async (): Promise<void> => {
    setError('');
    try {
      await release(houseId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_release'));
    }
  }, [release, houseId, t]);

  const handleCancel  = useCallback((id: string): void => { cancelReservation(id); }, [cancelReservation]);
  const handleApprove = useCallback((id: string, hid: string): void => { approveReservation(id, hid); }, [approveReservation]);

  const renderReservation = useCallback(
    ({ item }: { item: ParkingReservation }): React.JSX.Element => (
      <ReservationCard
        item={item}
        currentUser={myName}
        onCancel={handleCancel}
        onApprove={handleApprove}
        houseId={houseId ?? ''}
      />
    ),
    [myName, handleCancel, handleApprove, houseId]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        renderItem={renderReservation}
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
                    : `${current?.occupant} is parked since ${formatTime(current!.startTime)}.`}
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

            {/* ── Reservations header ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.eyebrow}>{t('parking.reservations')}</Text>
              <Pressable onPress={() => setShowReserve(true)} style={styles.addBtn} accessibilityRole="button">
                <Ionicons name="add" size={14} color={colors.primary} />
                <Text style={styles.addBtnText}>{t('parking.reserve')}</Text>
              </Pressable>
            </View>

            {reservations.length > 0 && (
              <View style={styles.upcomingRow}>
                <Text style={styles.eyebrow}>{t('parking.upcoming')}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{reservations.length}</Text>
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
            <Text style={styles.emptyText}>Reserve ahead of time so housemates know when the spot is taken.</Text>
          </View>
        }
      />

      <ReserveModal
        visible={showReserve}
        onClose={() => setShowReserve(false)}
        myName={myName}
        houseId={houseId ?? ''}
        reservations={reservations}
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
  eyebrow: { fontSize: 12, ...font.bold, color: colors.textSecondary, letterSpacing: 0.72, textTransform: 'uppercase' },
  upcomingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, marginBottom: 12,
  },
  countPill: {
    minHeight: 22, paddingHorizontal: 8, borderRadius: 9999,
    backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  countPillText: { fontSize: 11, ...font.bold, color: colors.secondaryForeground },

  resCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(44,51,61,0.02)',
  } as never,
  resIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  resInfo: { flex: 1, gap: 3 },
  resDate: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  resBy: { fontSize: 13, ...font.regular, color: colors.textSecondary },
  badge: {
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 9999, marginTop: 2,
  },
  badgeGreen: { backgroundColor: colors.positive + '20' },
  badgeYellow: { backgroundColor: colors.warning + '20' },
  badgeText: { fontSize: 11, ...font.semibold },
  resActions: { gap: 8 },
  cancelBtn: { padding: 4 },
  approveBtn: {
    backgroundColor: colors.positive + '18',
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
  },
  approveBtnText: { color: colors.positive, fontSize: 13, ...font.semibold },

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
