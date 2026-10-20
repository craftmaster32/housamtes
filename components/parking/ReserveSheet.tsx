import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { CalendarPicker } from '@components/shared/CalendarPicker';
import { TimePicker } from '@components/shared/TimePicker';
import { useHandFont } from '@hooks/useHandFont';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useHousematesStore } from '@stores/housematesStore';
import {
  useParkingStore,
  isDateConflict,
  type ConflictResult,
  type ParkingReservation,
  type ParkingSession,
} from '@stores/parkingStore';
import { resolveName } from '@utils/housemates';
import { todayString } from '@utils/parkingDates';
import { mf, ms } from '@utils/responsive';

export interface ReserveSheetProps {
  visible: boolean;
  onClose: () => void;
  myId: string;
  myName: string;
  houseId: string;
  reservations: ParkingReservation[];
  current: ParkingSession | null;
}

/**
 * "Reserve Parking" bottom sheet: pick a day, optional start/end times and a
 * note. Clashes show on a blue sticky note; Cancel is a link, Request the big
 * blue button.
 */
export function ReserveSheet({
  visible,
  onClose,
  myId,
  myName,
  houseId,
  reservations,
  current,
}: ReserveSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const addReservation = useParkingStore((s) => s.addReservation);
  const syncParkingPending = useCalendarSyncStore((s) => s.syncParkingPending);
  const housemates = useHousematesStore((s) => s.housemates);
  const todayStr = todayString();
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
        : t('parking.currently_using_other', {
            name: resolveName(current.occupant, housemates, t('common.unknown')),
          })
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
  // A hard clash replaces everything else; otherwise any softer warnings show.
  const stickyLines = dateConflict
    ? [dateConflict]
    : [dateWarning, activeConflict].filter((s): s is string => !!s);

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

  const handleDateChange = useCallback((d: string): void => {
    setDate(d);
    setError('');
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    if (saving) return; // guard against a double-tap creating two reservations
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
    } catch {
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
    saving,
  ]);

  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const disabled = saving || !!dateConflict;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('parking.title')}
            title={t('parking.reserve_parking')}
            onClose={handleClose}
          />
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>{t('parking.date')}</Text>
              <CalendarPicker value={date} onChange={handleDateChange} />
            </View>

            {stickyLines.length > 0 && (
              <View style={[styles.sticky, { backgroundColor: c.note }]} accessibilityRole="alert">
                {stickyLines.map((line) => (
                  <Text key={line} style={[styles.stickyText, hand, { color: c.noteInk }]}>
                    {line}
                  </Text>
                ))}
              </View>
            )}

            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {t('parking.start_time')}
              </Text>
              <TimePicker value={startTime} onChange={setStartTime} />
            </View>
            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {t('parking.end_time')}
              </Text>
              <TimePicker value={endTime} onChange={setEndTime} />
            </View>

            <UnderlineInput
              label={t('parking.note_label')}
              value={note}
              onChangeText={setNote}
              placeholder={t('parking.note_placeholder')}
              accessibilityLabel={t('parking.note_label')}
            />

            {!!error && (
              <Text style={[styles.error, { color: c.danger }]} accessibilityRole="alert">
                {error}
              </Text>
            )}

            <View style={styles.foot}>
              <Pressable
                style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
                onPress={handleClose}
                accessible
                accessibilityRole="button"
              >
                <Text style={[styles.cancelText, { color: c.primary }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: c.primary },
                  (disabled || pressed) && styles.dimmed,
                ]}
                onPress={handleSave}
                disabled={disabled}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled, busy: saving }}
              >
                <Text style={styles.primaryText}>{saving ? '…' : t('parking.request')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingBottom: ms(32), gap: ms(18) },
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(6) },
  sticky: {
    gap: ms(6),
    paddingHorizontal: ms(12),
    paddingVertical: ms(10),
    borderRadius: 2,
    transform: [{ rotate: '-1deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  stickyText: { fontSize: mf(19), lineHeight: mf(22) },
  error: { fontSize: mf(14), ...font.medium },
  foot: { flexDirection: 'row', alignItems: 'center', gap: ms(18) },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ms(6) },
  cancelText: { fontSize: mf(16), ...font.bold },
  primaryBtn: {
    flex: 1,
    minHeight: ms(56),
    borderRadius: ms(18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  primaryText: { color: '#FFFFFF', fontSize: mf(17), ...font.bold },
});
