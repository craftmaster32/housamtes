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
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { ReminderDateTimeField } from '@components/grocery/ReminderDateTimeField';

export interface GroceryReminderModalProps {
  visible: boolean;
  defaultLabel?: string;
  onClose: () => void;
  onSave: (label: string, remindAt: string) => Promise<void>;
}

export function GroceryReminderModal({
  visible,
  defaultLabel = '',
  onClose,
  onSave,
}: GroceryReminderModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(), []);

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

  return (
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
              accessibilityLabel={t('grocery.reminder_label')}
              accessibilityHint={t('grocery.reminder_label_hint')}
            />
          </View>

          <ReminderDateTimeField visible={visible} onChange={setRemindAtIso} />

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
