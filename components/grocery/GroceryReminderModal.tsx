import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { enUS, es as dateFnsEs, he as dateFnsHe } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { TimePicker } from '@components/shared/TimePicker';

export interface GroceryReminderModalProps {
  visible: boolean;
  defaultLabel?: string;
  onClose: () => void;
  onSave: (label: string, remindAt: string) => Promise<void>;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nextRoundedTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  return `${pad(now.getHours())}:${pad(Math.floor(now.getMinutes() / 5) * 5)}`;
}

export function GroceryReminderModal({
  visible,
  defaultLabel = '',
  onClose,
  onSave,
}: GroceryReminderModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(), []);

  const [label, setLabel] = useState('');
  const [date, setDate] = useState(todayDateString());
  const [time, setTime] = useState(nextRoundedTime());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLabel(defaultLabel);
      setDate(todayDateString());
      setTime(nextRoundedTime());
      setSaveError(null);
    }
  }, [visible, defaultLabel]);

  const remindAtIso = useMemo(() => {
    if (!date || !time) return null;
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }, [date, time]);

  const isFuture = remindAtIso !== null && new Date(remindAtIso).getTime() > Date.now();
  const canSave = label.trim().length > 0 && isFuture && !isSaving;

  const dateFnsLocale =
    ({ en: enUS, es: dateFnsEs, he: dateFnsHe } as const)[i18n.language as 'en' | 'es' | 'he'] ??
    enUS;
  const [dy, dm, dd] = date.split('-').map(Number);
  const displayDate = format(new Date(dy, (dm ?? 1) - 1, dd ?? 1), 'EEE, MMM d', {
    locale: dateFnsLocale,
  });

  const handleSave = useCallback(async (): Promise<void> => {
    if (!canSave || !remindAtIso) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(label.trim(), remindAtIso);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch {
      setSaveError(t('grocery.reminder_save_error'));
    } finally {
      setIsSaving(false);
    }
  }, [canSave, remindAtIso, label, onSave, onClose, t]);

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={s.backdrop} onPress={onClose} accessible={false} />
          <View style={[s.sheet, { backgroundColor: C.surface }]}>
            <View style={s.header}>
              <Text style={[s.title, { color: C.textPrimary }]}>{t('grocery.set_reminder')}</Text>
              <Pressable
                onPress={onClose}
                style={s.closeBtn}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Ionicons name="close" size={22} color={C.textSecondary} />
              </Pressable>
            </View>

            <View
              style={[s.inputBox, { backgroundColor: C.surfaceSecondary, borderColor: C.border }]}
            >
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder={t('grocery.reminder_label_placeholder')}
                placeholderTextColor={C.textSecondary}
                style={[s.input, { color: C.textPrimary }]}
                maxLength={200}
                accessible
                accessibilityRole="text"
                accessibilityLabel={t('grocery.reminder_label')}
                accessibilityHint={t('grocery.reminder_label_hint')}
              />
            </View>

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>
                {t('grocery.reminder_date')}
              </Text>
              <Pressable
                style={[
                  s.dateTrigger,
                  { backgroundColor: C.surfaceSecondary, borderColor: C.border },
                ]}
                onPress={() => setShowDatePicker(true)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('bills.pick_date')}
                accessibilityState={{ expanded: showDatePicker }}
              >
                <Ionicons name="calendar-outline" size={18} color={C.primary} />
                <Text style={[s.dateTriggerText, { color: C.textPrimary }]}>{displayDate}</Text>
                <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
              </Pressable>
            </View>

            <View style={s.field}>
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>
                {t('grocery.reminder_time')}
              </Text>
              <TimePicker value={time} onChange={setTime} />
            </View>

            {!isFuture && !!time && (
              <Text style={s.saveError}>{t('grocery.reminder_must_be_future')}</Text>
            )}
            {!!saveError && <Text style={s.saveError}>{saveError}</Text>}

            <View style={s.actions}>
              <Pressable
                onPress={onClose}
                style={[s.btn, { borderColor: C.border }]}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={[s.btnText, { color: C.textSecondary }]}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={[s.btn, s.btnPrimary, { backgroundColor: C.primary }, !canSave && s.btnOff]}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                accessibilityLabel={isSaving ? t('grocery.saving') : t('grocery.set_reminder')}
              >
                <Text style={[s.btnText, s.btnPrimaryText]}>
                  {isSaving ? t('grocery.saving') : t('grocery.set_reminder')}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={setDate}
        onClose={() => setShowDatePicker(false)}
      />
    </>
  );
}

function makeStyles(): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 44,
      gap: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, ...font.bold },
    closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    inputBox: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
    input: { fontSize: 15, ...font.regular, minHeight: 48 },
    field: { gap: 8 },
    fieldLabel: { fontSize: 12, ...font.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
    dateTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      minHeight: 48,
    },
    dateTriggerText: { flex: 1, fontSize: 15, ...font.medium },
    saveError: { fontSize: 12, color: '#D94F4F' },
    actions: { flexDirection: 'row', gap: 10 },
    btn: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
    },
    btnPrimary: { borderWidth: 0 },
    btnOff: { opacity: 0.5 },
    btnText: { fontSize: 15, ...font.semibold },
    btnPrimaryText: { color: '#FFFFFF' },
  });
}
