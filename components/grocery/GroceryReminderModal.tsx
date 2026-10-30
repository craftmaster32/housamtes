import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { Alert } from '@lib/alert';
import { getDateFnsLocale } from '@utils/dates';
import type { GroceryReminder } from '@stores/groceryStore';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { ReminderDateTimeField } from '@components/grocery/ReminderDateTimeField';
import { mf, ms } from '@utils/responsive';

// The pink of the reminder tag clipped to the bag.
const TAG = '#F6D8D2';
const TAG_INK = '#8E2F28';

export interface GroceryReminderModalProps {
  visible: boolean;
  defaultLabel?: string;
  /** Upcoming reminders, shown as pink tags above the form. */
  reminders: GroceryReminder[];
  onDelete: (id: string) => void;
  onClose: () => void;
  onSave: (label: string, remindAt: string) => Promise<void>;
}

/** Your grocery reminders as pink tags, and "Set reminder" with the note, date and time on lines. */
export function GroceryReminderModal({
  visible,
  defaultLabel = '',
  reminders,
  onDelete,
  onClose,
  onSave,
}: GroceryReminderModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const dateLocale = getDateFnsLocale(i18n.language);

  const [label, setLabel] = useState('');
  const [remindAtIso, setRemindAtIso] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setLabel(defaultLabel);
      setSaveError(null);
    }
  }, [visible, defaultLabel]);

  const isFuture = remindAtIso !== null && new Date(remindAtIso).getTime() > Date.now();
  const canSave = label.trim().length > 0 && isFuture && !isSaving;

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

  const handleDelete = useCallback(
    (reminder: GroceryReminder): void => {
      Alert.alert(t('grocery.cancel_reminder_title'), t('grocery.cancel_reminder_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: (): void => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onDelete(reminder.id);
          },
        },
      ]);
    },
    [onDelete, t]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('grocery.reminders')}
            title={t('grocery.set_reminder')}
            onClose={onClose}
          />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.sub, { color: c.textSecondary }]}>
              {t('grocery.reminder_sub')}
            </Text>

            {reminders.map((r) => (
              <View key={r.id} style={[styles.reminder, { borderBottomColor: c.border }]}>
                <View style={styles.tag}>
                  <Text style={[styles.tagText, hand]}>
                    {format(new Date(r.remindAt), 'EEE p', { locale: dateLocale })}
                  </Text>
                </View>
                <Text style={[styles.reminderLabel, { color: c.textPrimary }]} numberOfLines={2}>
                  {r.label}
                </Text>
                <Pressable
                  onPress={() => handleDelete(r)}
                  style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.cancel_reminder_name', { name: r.label })}
                >
                  <Text style={[styles.cancelText, { color: c.negative }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
              </View>
            ))}

            <UnderlineInput
              label={t('grocery.reminder_label')}
              value={label}
              onChangeText={setLabel}
              placeholder={t('grocery.reminder_label_placeholder')}
              accessibilityLabel={t('grocery.reminder_label')}
              accessibilityHint={t('grocery.reminder_label_hint')}
            />

            <ReminderDateTimeField visible={visible} onChange={setRemindAtIso} />

            {!!saveError && <Text style={[styles.error, { color: c.danger }]}>{saveError}</Text>}

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: c.primary },
                (!canSave || pressed) && styles.dim,
              ]}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              accessibilityLabel={isSaving ? t('grocery.saving') : t('grocery.set_reminder')}
            >
              <Text style={styles.primaryText}>
                {isSaving ? t('grocery.saving') : t('grocery.set_reminder')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '90%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(36), gap: ms(16) },
  sub: { fontSize: mf(14), ...font.regular, lineHeight: mf(20) },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    minHeight: 54,
    borderBottomWidth: 1.5,
  },
  tag: {
    backgroundColor: TAG,
    paddingHorizontal: ms(8),
    paddingVertical: ms(3),
    transform: [{ rotate: '-3deg' }],
    minWidth: ms(70),
    alignItems: 'center',
  },
  tagText: { fontSize: mf(17), color: TAG_INK },
  reminderLabel: { flex: 1, fontSize: mf(15.5), ...font.semibold },
  cancelBtn: { minHeight: 44, justifyContent: 'center' },
  cancelText: { fontSize: mf(14), ...font.semibold },
  error: { fontSize: mf(13) },
  primary: { minHeight: 52, borderRadius: ms(17), alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
  pressed: { opacity: 0.6 },
});
