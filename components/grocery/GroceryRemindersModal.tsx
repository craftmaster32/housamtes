import { useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { type GroceryReminder } from '@stores/groceryStore';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { getDateFnsLocale } from '@utils/dates';

export interface GroceryRemindersModalProps {
  visible: boolean;
  reminders: GroceryReminder[];
  isLoading: boolean;
  error: string | null;
  onAddReminder: () => void;
  onDeleteReminder: (id: string) => void;
  onClose: () => void;
}

export function GroceryRemindersModal({
  visible,
  reminders,
  isLoading,
  error,
  onAddReminder,
  onDeleteReminder,
  onClose,
}: GroceryRemindersModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const dateFnsLocale = getDateFnsLocale(i18n.language);

  const handleDelete = useCallback(
    (reminder: GroceryReminder): void => {
      Alert.alert(t('grocery.cancel_reminder_title'), t('grocery.cancel_reminder_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: (): void => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            onDeleteReminder(reminder.id);
          },
        },
      ]);
    },
    [onDeleteReminder, t]
  );

  const handleAdd = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    onAddReminder();
  }, [onAddReminder]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessible={false} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('grocery.reminders')}</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={22} color={C.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {isLoading && (
              <ActivityIndicator size="small" color={C.primary} style={styles.loader} />
            )}

            {!isLoading && !!error && <Text style={styles.errorText}>{error}</Text>}

            {!isLoading && !error && reminders.length === 0 && (
              <Text style={styles.emptyText}>{t('grocery.no_reminders')}</Text>
            )}

            {reminders.map((reminder) => (
              <View key={reminder.id} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {reminder.label}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {format(new Date(reminder.remindAt), 'EEE, MMM d · p', {
                      locale: dateFnsLocale,
                    })}
                  </Text>
                </View>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => handleDelete(reminder)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.cancel_reminder_name', { name: reminder.label })}
                >
                  <Ionicons name="close-circle-outline" size={19} color={C.textDisabled} />
                </Pressable>
              </View>
            ))}

            <Pressable
              style={styles.addBtn}
              onPress={handleAdd}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('grocery.set_reminder')}
            >
              <Ionicons name="add-circle-outline" size={17} color={C.primary} />
              <Text style={styles.addBtnText}>{t('grocery.set_reminder')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      backgroundColor: C.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 44,
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, ...font.bold, color: C.textPrimary },
    closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    body: { gap: 6 },
    loader: { marginVertical: 12 },
    emptyText: { fontSize: 13, ...font.regular, color: C.textSecondary, paddingVertical: 8 },
    errorText: { fontSize: 13, ...font.regular, color: C.danger, paddingVertical: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      gap: 10,
    },
    rowInfo: { flex: 1, gap: 2 },
    rowLabel: { fontSize: 14, ...font.semibold, color: C.textPrimary },
    rowMeta: { fontSize: 12, ...font.regular, color: C.textSecondary },
    iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingVertical: 8,
      paddingHorizontal: 14,
      marginTop: 4,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.primary,
      backgroundColor: C.secondary,
    },
    addBtnText: { fontSize: 14, ...font.medium, color: C.primary },
  });
}
