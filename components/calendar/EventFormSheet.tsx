import { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { HouseEvent } from '@stores/eventsStore';
import { useEventForm } from '@hooks/useEventForm';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { LineField } from '@components/parking/LineField';
import { TimePickerModal } from '@components/parking/TimePickerModal';
import { RepeatFields } from '@components/calendar/RepeatFields';
import { formatShortDate } from '@components/calendar/calendarMeta';
import { mf, ms } from '@utils/responsive';

interface EventFormSheetProps {
  visible: boolean;
  initialDate: string;
  editingEvent?: HouseEvent;
  onClose: () => void;
}

type DateTarget = 'start' | 'end' | 'until' | null;
type TimeTarget = 'start' | 'end' | null;

/** Add or edit a house event, written on lines in a bottom sheet. */
export function EventFormSheet({
  visible,
  initialDate,
  editingEvent,
  onClose,
}: EventFormSheetProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const [dateTarget, setDateTarget] = useState<DateTarget>(null);
  const [timeTarget, setTimeTarget] = useState<TimeTarget>(null);

  const {
    title,
    setTitle,
    date,
    setDate,
    showEndDate,
    setShowEndDate,
    endDate,
    setEndDate,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    notes,
    setNotes,
    recurrence,
    setRecurrence,
    recurrenceInterval,
    recurrenceDays,
    customMode,
    smartText,
    setSmartText,
    smartFeedback,
    setSmartFeedback,
    showRecEnd,
    setShowRecEnd,
    recurrenceEnd,
    setRecurrenceEnd,
    saving,
    error,
    setError,
    handleClose,
    handleSave,
    handlePreset,
    adjustInterval,
    toggleDay,
    handleApplySmart,
    activePreset,
  } = useEventForm({ visible, initialDate, editingEvent, onClose });

  const isEditing = !!editingEvent;
  const fmt = useCallback(
    (ymd: string): string => formatShortDate(ymd, i18n.language),
    [i18n.language]
  );

  const datePickerValue =
    dateTarget === 'end' ? endDate || date : dateTarget === 'until' ? recurrenceEnd || date : date;
  const handlePickDate = useCallback(
    (v: string): void => {
      if (dateTarget === 'start') setDate(v);
      else if (dateTarget === 'end') setEndDate(v);
      else if (dateTarget === 'until') setRecurrenceEnd(v);
      setError('');
      setDateTarget(null);
    },
    [dateTarget, setDate, setEndDate, setRecurrenceEnd, setError]
  );

  const timeValue = timeTarget === 'end' ? endTime || startTime || '18:00' : startTime || '18:00';
  const handlePickTime = useCallback(
    (v: string): void => {
      if (timeTarget === 'start') setStartTime(v);
      else setEndTime(v);
      setTimeTarget(null);
    },
    [timeTarget, setStartTime, setEndTime]
  );
  const handleClearTime = useCallback((): void => {
    if (timeTarget === 'start') setStartTime('');
    else setEndTime('');
    setTimeTarget(null);
  }, [timeTarget, setStartTime, setEndTime]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={Keyboard.dismiss}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={isEditing ? t('calendar.edit_event_sub') : t('calendar.add_event_sub')}
            title={isEditing ? t('calendar.edit_event') : t('calendar.add_event')}
            onClose={handleClose}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <UnderlineInput
              label={t('calendar.event_name')}
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                setError('');
              }}
              placeholder={t('calendar.event_name_placeholder')}
              accessibilityLabel={t('calendar.event_name')}
              accessibilityHint={t('calendar.event_name_hint')}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={styles.pair}>
              <View style={styles.half}>
                <LineField
                  label={t('calendar.start_date')}
                  value={date ? fmt(date) : ''}
                  icon="calendar-outline"
                  onPress={() => setDateTarget('start')}
                />
              </View>
              <View style={styles.half}>
                {showEndDate ? (
                  <LineField
                    label={t('calendar.end_date')}
                    value={endDate ? fmt(endDate) : ''}
                    icon="calendar-outline"
                    onPress={() => setDateTarget('end')}
                    accessibilityHint={t('calendar.add_end_date_hint')}
                  />
                ) : (
                  <Pressable
                    style={styles.addEnd}
                    onPress={() => {
                      setShowEndDate(true);
                      setEndDate(date);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('calendar.add_end_date')}
                    accessibilityHint={t('calendar.add_end_date_hint')}
                  >
                    <Text style={[styles.linkText, { color: c.primary }]}>
                      {t('calendar.add_end_date')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
            {showEndDate && (
              <Pressable
                style={styles.link}
                onPress={() => {
                  setShowEndDate(false);
                  setEndDate('');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('calendar.remove_end_date')}
              >
                <Text style={[styles.linkText, { color: c.textSecondary }]}>
                  {t('calendar.remove_end_date')}
                </Text>
              </Pressable>
            )}

            <View style={styles.pair}>
              <View style={styles.half}>
                <LineField
                  label={t('calendar.start_time')}
                  value={startTime}
                  placeholder="--:--"
                  icon="time-outline"
                  onPress={() => setTimeTarget('start')}
                />
              </View>
              <View style={styles.half}>
                <LineField
                  label={t('calendar.end_time')}
                  value={endTime}
                  placeholder="--:--"
                  icon="time-outline"
                  onPress={() => setTimeTarget('end')}
                />
              </View>
            </View>

            <UnderlineInput
              label={`${t('calendar.notes')} (${t('common.optional')})`}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('calendar.notes_placeholder')}
              multiline
              accessibilityLabel={t('calendar.notes')}
              accessibilityHint={t('calendar.notes_hint')}
            />

            <RepeatFields
              smartText={smartText}
              smartFeedback={smartFeedback}
              onSmartText={(v) => {
                setSmartText(v);
                setSmartFeedback(null);
              }}
              onApplySmart={handleApplySmart}
              activePreset={activePreset}
              onPreset={handlePreset}
              customMode={customMode}
              recurrence={recurrence}
              onUnit={setRecurrence}
              interval={recurrenceInterval}
              onInterval={adjustInterval}
              days={recurrenceDays}
              onToggleDay={toggleDay}
              showUntil={showRecEnd}
              until={recurrenceEnd}
              onOpenUntil={() => {
                setShowRecEnd(true);
                setDateTarget('until');
              }}
              onClearUntil={() => {
                setShowRecEnd(false);
                setRecurrenceEnd('');
              }}
            />

            {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: c.primary },
                (saving || pressed) && styles.dim,
              ]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
            >
              <Text style={styles.submitText}>
                {saving
                  ? t('calendar.saving')
                  : isEditing
                    ? t('calendar.save_changes')
                    : t('calendar.save_event')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={dateTarget !== null}
        value={datePickerValue}
        onSelect={handlePickDate}
        onClose={() => setDateTarget(null)}
      />
      <TimePickerModal
        visible={timeTarget !== null}
        title={timeTarget === 'end' ? t('calendar.end_time') : t('calendar.start_time')}
        value={timeValue}
        onSelect={handlePickTime}
        onClear={handleClearTime}
        onClose={() => setTimeTarget(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '94%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(40), gap: ms(18) },
  pair: { flexDirection: 'row', gap: ms(16), alignItems: 'flex-end' },
  half: { flex: 1, minWidth: 0 },
  addEnd: { minHeight: 44, justifyContent: 'center' },
  link: { minHeight: 36, justifyContent: 'center', alignSelf: 'flex-start', marginTop: -ms(12) },
  linkText: { fontSize: mf(14.5), ...font.semibold },
  error: { fontSize: mf(13.5), ...font.regular },
  submit: {
    minHeight: 52,
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  submitText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
