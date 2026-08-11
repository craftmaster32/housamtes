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
import { useHeadingFont } from '@hooks/useHeadingFont';
import { ReminderDateTimeField } from '@components/grocery/ReminderDateTimeField';

import { mf, ms } from '@utils/responsive';
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
  const headingFont = useHeadingFont('bold');

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
          <View style={[s.handle, { backgroundColor: C.border }]} />
          <View style={s.header}>
            <View style={s.headerText}>
              <Text style={[s.title, headingFont, { color: C.textPrimary }]}>
                {t('grocery.set_reminder')}
              </Text>
              <Text style={[s.subtitle, { color: C.textSecondary }]}>
                {t('grocery.reminder_sub')}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[s.closeBtn, { backgroundColor: C.surfaceSecondary }]}
              hitSlop={{ top: ms(7), bottom: ms(7), left: ms(7), right: ms(7) }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={18} color={C.textSecondary} />
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

          {!!saveError && <Text style={[s.saveError, { color: C.danger }]}>{saveError}</Text>}

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
      borderTopLeftRadius: ms(26),
      borderTopRightRadius: ms(26),
      padding: ms(22),
      paddingBottom: ms(40),
      gap: ms(14),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(-4) },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    handle: {
      width: ms(40),
      height: ms(4),
      borderRadius: ms(2),
      alignSelf: 'center',
      marginBottom: ms(2),
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    headerText: { flex: 1 },
    title: { fontSize: mf(21), letterSpacing: -0.3 },
    subtitle: { fontSize: mf(12.5), ...font.medium, marginTop: ms(2) },
    closeBtn: {
      width: ms(30),
      height: ms(30),
      borderRadius: ms(15),
      justifyContent: 'center',
      alignItems: 'center',
    },
    inputBox: { borderRadius: ms(12), borderWidth: 1, paddingHorizontal: ms(14) },
    input: { fontSize: mf(15), ...font.regular, minHeight: ms(48) },
    saveError: { fontSize: mf(12) },
    actions: { flexDirection: 'row', gap: ms(10), marginTop: ms(2) },
    btn: {
      flex: 1,
      height: ms(50),
      borderRadius: ms(14),
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
    },
    btnPrimary: {
      borderWidth: 0,
      shadowColor: '#3B6FBF',
      shadowOffset: { width: 0, height: ms(8) },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 6,
    },
    btnOff: { opacity: 0.5 },
    btnText: { fontSize: mf(15), ...font.bold },
    btnPrimaryText: { color: '#FFFFFF' },
  });
}
