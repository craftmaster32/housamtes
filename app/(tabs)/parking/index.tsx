import { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useParkingStore, isDateConflict, type ParkingReservation } from '@stores/parkingStore';
import { useAuthStore } from '@stores/authStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

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
}: {
  item: ParkingReservation;
  currentUser: string;
  onCancel: (id: string) => void;
  onApprove: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const isOwn = item.requestedBy === currentUser;
  return (
    <View style={styles.resCard}>
      <View style={styles.resInfo}>
        <Text style={styles.resDate}>{formatDate(item.date)}</Text>
        <Text style={styles.resBy}>
          {isOwn ? t('common.by') : item.requestedBy}
          {item.note ? ` · ${item.note}` : ''}
        </Text>
        <View style={[styles.badge, item.status === 'approved' ? styles.badgeGreen : styles.badgeYellow]}>
          <Text style={styles.badgeText}>{item.status === 'approved' ? t('parking.approved') : t('parking.pending')}</Text>
        </View>
      </View>
      <View style={styles.resActions}>
        {isOwn && (
          <Pressable onPress={() => onCancel(item.id)} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        )}
        {!isOwn && item.status === 'pending' && (
          <Pressable onPress={() => onApprove(item.id)} style={styles.approveBtn}>
            <Text style={styles.approveBtnText}>{t('parking.approve')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function ParkingScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const current = useParkingStore((state) => state.current);
  const reservations = useParkingStore((state) => state.reservations);
  const claim = useParkingStore((state) => state.claim);
  const release = useParkingStore((state) => state.release);
  const addReservation = useParkingStore((state) => state.addReservation);
  const cancelReservation = useParkingStore((state) => state.cancelReservation);
  const approveReservation = useParkingStore((state) => state.approveReservation);

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);

  const myName = profile?.name ?? '';
  const isMine = current?.occupant === myName;
  const isFree = !current;

  const [showReserveForm, setShowReserveForm] = useState(false);
  const [resDate, setResDate] = useState(new Date().toISOString().split('T')[0]);
  const [resNote, setResNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const dateConflict = showReserveForm ? isDateConflict(resDate, reservations) : null;

  const handleClaim = useCallback(async () => {
    setError('');
    try {
      await claim(myName, houseId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_claim'));
    }
  }, [claim, myName, houseId, t]);

  const handleRelease = useCallback(async () => {
    setError('');
    try {
      await release(houseId ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_release'));
    }
  }, [release, houseId, t]);

  const handleReserve = useCallback(async () => {
    if (!resDate) return;
    setIsSaving(true);
    setError('');
    try {
      await addReservation({ requestedBy: myName, date: resDate, note: resNote }, houseId ?? '');
      setResDate(new Date().toISOString().split('T')[0]);
      setResNote('');
      setShowReserveForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('parking.failed_reservation'));
    } finally {
      setIsSaving(false);
    }
  }, [resDate, resNote, myName, houseId, addReservation, t]);

  const handleCancel = useCallback((id: string) => { cancelReservation(id); }, [cancelReservation]);
  const handleApprove = useCallback((id: string) => { approveReservation(id); }, [approveReservation]);

  const renderReservation = useCallback(
    ({ item }: { item: ParkingReservation }) => (
      <ReservationCard
        item={item}
        currentUser={myName}
        onCancel={handleCancel}
        onApprove={handleApprove}
      />
    ),
    [myName, handleCancel, handleApprove]
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        renderItem={renderReservation}
        ListHeaderComponent={
          <View>
            <Text style={styles.heading}>{t('parking.title')}</Text>

            {/* Status card */}
            <View style={[styles.statusCard, { backgroundColor: isFree ? colors.positive + '15' : colors.negative + '15' }]}>
              <View style={[styles.spotIcon, { backgroundColor: isFree ? colors.positive : colors.negative }]}>
                <Text style={styles.spotIconText}>P</Text>
              </View>
              <Text style={[styles.statusText, { color: isFree ? colors.positive : colors.negative }]}>
                {isFree ? t('parking.spot_free') : t('parking.taken_by', { name: current?.occupant })}
              </Text>
              {current && !isFree && (
                <Text style={styles.statusSince}>{t('parking.since', { time: formatTime(current.startTime) })}</Text>
              )}

              <View style={styles.statusButtons}>
                {isFree && (
                  <Button mode="contained" onPress={handleClaim} style={styles.claimBtn} contentStyle={{ height: 52 }}>
                    {t('parking.claim')}
                  </Button>
                )}
                {isMine && (
                  <Button mode="outlined" onPress={handleRelease} style={styles.releaseBtn} textColor={colors.negative} contentStyle={{ height: 52 }}>
                    {t('parking.release')}
                  </Button>
                )}
              </View>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Reserve section */}
            <View style={styles.reserveSection}>
                <View style={styles.reserveHeader}>
                  <Text style={styles.sectionTitle}>{t('parking.reservations')}</Text>
                  {!showReserveForm && (
                    <Pressable onPress={() => setShowReserveForm(true)} style={styles.addResBtn}>
                      <Text style={styles.addResBtnText}>{t('parking.reserve')}</Text>
                    </Pressable>
                  )}
                </View>

                {showReserveForm && (
                  <View style={styles.reserveForm}>
                    <TextInput
                      label={t('parking.date_placeholder')}
                      value={resDate}
                      onChangeText={(d) => { setResDate(d); setError(''); }}
                      mode="outlined"
                      style={styles.input}
                    />
                    {!!dateConflict && (
                      <Text style={styles.conflictText}>{t('parking.conflict_warning')} {dateConflict}</Text>
                    )}
                    <TextInput
                      label={t('parking.note_label')}
                      value={resNote}
                      onChangeText={setResNote}
                      mode="outlined"
                      style={styles.input}
                      placeholder={t('parking.note_placeholder')}
                    />
                    <View style={styles.formButtons}>
                      <Button mode="contained" onPress={handleReserve} loading={isSaving} disabled={isSaving || !!dateConflict} style={styles.saveResBtn}>
                        {t('parking.request')}
                      </Button>
                      <Button mode="text" onPress={() => setShowReserveForm(false)}>{t('common.cancel')}</Button>
                    </View>
                  </View>
                )}
              </View>

            {reservations.length > 0 && (
              <Text style={styles.upcomingLabel}>{t('parking.upcoming')}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          reservations.length === 0 ? (
            <Text style={styles.emptyText}>{t('parking.no_reservations')}</Text>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: sizes.lg, paddingBottom: 40 },
  heading: { color: colors.textPrimary, ...font.extrabold, fontSize: 26, letterSpacing: -0.5, marginBottom: sizes.md },
  statusCard: {
    borderRadius: 16,
    padding: sizes.lg,
    alignItems: 'center',
    gap: sizes.sm,
    marginBottom: sizes.lg,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  spotIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotIconText: { color: colors.white, fontSize: 28, ...font.bold },
  statusText: { ...font.bold, fontSize: 22 },
  statusSince: { color: colors.textSecondary, fontSize: 15, ...font.regular },
  statusButtons: { flexDirection: 'row', gap: sizes.sm, marginTop: sizes.xs },
  claimBtn: { borderRadius: 14 },
  releaseBtn: { borderRadius: 14, borderColor: colors.negative },
  reserveSection: { marginBottom: sizes.md },
  reserveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sizes.sm },
  sectionTitle: { color: colors.textPrimary, ...font.bold, fontSize: 17 },
  addResBtn: { backgroundColor: colors.primary + '20', paddingVertical: 4, paddingHorizontal: sizes.sm, borderRadius: sizes.borderRadiusFull },
  addResBtnText: { color: colors.primary, ...font.semibold, fontSize: sizes.fontSm },
  reserveForm: { backgroundColor: colors.white, borderRadius: 16, padding: sizes.md, gap: sizes.sm, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' } as never,
  input: { backgroundColor: colors.white },
  conflictText: { color: colors.warning, fontSize: 13, ...font.medium },
  formButtons: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
  saveResBtn: { borderRadius: 14 },
  upcomingLabel: { color: colors.textSecondary, fontSize: 12, ...font.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: sizes.sm },
  resCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.md,
    marginBottom: sizes.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  resInfo: { gap: 4 },
  resDate: { color: colors.textPrimary, ...font.semibold, fontSize: 15 },
  resBy: { color: colors.textSecondary, fontSize: 15, ...font.regular },
  badge: { alignSelf: 'flex-start', paddingHorizontal: sizes.xs, paddingVertical: 2, borderRadius: sizes.borderRadiusFull, marginTop: 2 },
  badgeGreen: { backgroundColor: colors.positive + '25' },
  badgeYellow: { backgroundColor: colors.warning + '25' },
  badgeText: { fontSize: 12, ...font.semibold, color: colors.textPrimary },
  resActions: { gap: sizes.xs },
  cancelBtn: { padding: sizes.xs },
  cancelBtnText: { color: colors.danger, fontSize: 15, ...font.regular },
  approveBtn: { backgroundColor: colors.positive + '20', padding: sizes.xs, borderRadius: sizes.borderRadiusSm, borderCurve: 'continuous' } as never,
  approveBtnText: { color: colors.positive, fontSize: 15, ...font.semibold },
  emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: sizes.md, ...font.regular, fontSize: 15 },
  errorBox: { backgroundColor: colors.danger + '15', borderRadius: sizes.borderRadius, padding: sizes.md, marginBottom: sizes.md },
  errorText: { color: colors.danger, fontSize: 15, ...font.regular },
});
