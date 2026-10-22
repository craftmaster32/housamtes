import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useHandFont } from '@hooks/useHandFont';
import { useReserveForm } from '@hooks/useReserveForm';
import { useLanguageStore } from '@stores/languageStore';
import type { ParkingReservation, ParkingSession } from '@stores/parkingStore';
import { parseDateParts } from '@utils/parkingDates';
import { mf, ms } from '@utils/responsive';
import { LineField } from './LineField';
import { TimePickerModal } from './TimePickerModal';

type TimeFieldKey = 'start' | 'end';

/** One hour after 'HH:MM' (capped at 23:55), as a starting point for the end time. */
function hourAfter(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return h >= 23 ? '23:55' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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
  const language = useLanguageStore((s) => s.language);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeField, setTimeField] = useState<TimeFieldKey | null>(null);
  const form = useReserveForm({ myId, myName, houseId, reservations, current, onDone: onClose });
  const { date, startTime, endTime, saving, dateConflict, setDate, setStartTime, setEndTime } =
    form;

  const handleClose = useCallback((): void => {
    form.reset();
    setShowDatePicker(false);
    setTimeField(null);
    onClose();
  }, [form, onClose]);

  // The date opens the pop-up calendar (a sibling Modal, see below).
  const openDatePicker = useCallback((): void => setShowDatePicker(true), []);
  const closeDatePicker = useCallback((): void => setShowDatePicker(false), []);
  const handleDateChange = useCallback(
    (d: string): void => {
      setDate(d);
      setShowDatePicker(false);
    },
    [setDate]
  );

  // Each time opens the time pop-up; Clear takes it back to no time.
  const openStart = useCallback((): void => setTimeField('start'), []);
  const openEnd = useCallback((): void => setTimeField('end'), []);
  const closeTime = useCallback((): void => setTimeField(null), []);
  const handleTimeSelect = useCallback(
    (time: string): void => {
      if (timeField === 'start') setStartTime(time);
      else setEndTime(time);
      setTimeField(null);
    },
    [timeField, setStartTime, setEndTime]
  );
  const handleTimeClear = useCallback((): void => {
    if (timeField === 'start') setStartTime('');
    else setEndTime('');
    setTimeField(null);
  }, [timeField, setStartTime, setEndTime]);
  const timeStart =
    timeField === 'start'
      ? startTime || '09:00'
      : endTime || (startTime ? hourAfter(startTime) : '10:00');

  const { dayNum, monthShort, weekdayFull } = parseDateParts(date, language);
  const dateLabel = `${weekdayFull}, ${dayNum} ${monthShort}`;
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const disabled = saving || !!dateConflict;

  return (
    <>
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
              <LineField
                label={t('parking.date')}
                value={dateLabel}
                icon="calendar-outline"
                onPress={openDatePicker}
                accessibilityHint={t('common.pick_date')}
              />

              {form.stickyLines.length > 0 && (
                <View
                  style={[styles.sticky, { backgroundColor: c.note }]}
                  accessibilityRole="alert"
                >
                  {form.stickyLines.map((line) => (
                    <Text key={line} style={[styles.stickyText, hand, { color: c.noteInk }]}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <LineField
                    label={t('parking.start_time')}
                    value={startTime}
                    placeholder="--:--"
                    icon="time-outline"
                    onPress={openStart}
                  />
                </View>
                <View style={styles.col}>
                  <LineField
                    label={t('parking.end_time')}
                    value={endTime}
                    placeholder="--:--"
                    icon="time-outline"
                    onPress={openEnd}
                  />
                </View>
              </View>

              <UnderlineInput
                label={t('parking.note_label')}
                value={form.note}
                onChangeText={form.setNote}
                placeholder={t('parking.note_placeholder')}
                accessibilityLabel={t('parking.note_label')}
              />

              {!!form.error && (
                <Text style={[styles.error, { color: c.danger }]} accessibilityRole="alert">
                  {form.error}
                </Text>
              )}

              <View style={styles.foot}>
                <Pressable
                  style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
                  onPress={handleClose}
                  accessible
                  accessibilityRole="button"
                >
                  <Text style={[styles.cancelText, { color: c.primary }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: c.primary },
                    (disabled || pressed) && styles.dimmed,
                  ]}
                  onPress={form.handleSave}
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

      {/* Sibling of the sheet (not nested) — nested RN Modals misbehave on Android. */}
      <DatePickerModal
        visible={visible && showDatePicker}
        value={date}
        onSelect={handleDateChange}
        onClose={closeDatePicker}
      />
      <TimePickerModal
        visible={visible && timeField !== null}
        title={timeField === 'start' ? t('parking.start_time') : t('parking.end_time')}
        value={timeStart}
        onSelect={handleTimeSelect}
        onClear={handleTimeClear}
        onClose={closeTime}
      />
    </>
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
  twoCol: { flexDirection: 'row', gap: ms(16) },
  col: { flex: 1, minWidth: 0 },
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
    borderRadius: ms(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  primaryText: { color: '#FFFFFF', fontSize: mf(17), ...font.bold },
});
