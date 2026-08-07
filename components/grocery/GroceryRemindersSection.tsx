import { useState, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
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

import { mf, ms } from '@utils/responsive';
interface GroceryRemindersSectionProps {
  reminders: GroceryReminder[];
  isLoading: boolean;
  error: string | null;
  onAddReminder: () => void;
  onDeleteReminder: (id: string) => void;
}

export function GroceryRemindersSection({
  reminders,
  isLoading,
  error,
  onAddReminder,
  onDeleteReminder,
}: GroceryRemindersSectionProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [expanded, setExpanded] = useState(false);

  const dateFnsLocale = getDateFnsLocale(i18n.language);

  const handleToggle = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((v) => !v);
  }, []);

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
    <View style={styles.container}>
      <Pressable
        style={styles.headerRow}
        onPress={handleToggle}
        accessible
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('grocery.reminders_count', { count: reminders.length })}
      >
        <View style={styles.headerLeft}>
          <Ionicons name="alarm-outline" size={16} color={C.textPrimary} />
          <Text style={styles.headerLabel}>{t('grocery.reminders')}</Text>
          {reminders.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{reminders.length}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={C.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {isLoading && <LoadingSpinner size={64} style={styles.loader} />}

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
      )}
    </View>
  );
}

function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    container: {
      backgroundColor: C.surface,
      borderRadius: ms(16),
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      marginBottom: ms(16),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: ms(16),
      paddingVertical: ms(14),
      minHeight: ms(48),
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
    headerLabel: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    badge: {
      backgroundColor: C.primary,
      borderRadius: 9999,
      minWidth: ms(20),
      height: ms(20),
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: ms(5),
    },
    badgeText: { fontSize: mf(11), ...font.bold, color: '#fff' },
    body: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingHorizontal: ms(16),
      paddingBottom: ms(12),
      paddingTop: ms(8),
      gap: ms(6),
    },
    loader: { marginVertical: ms(12) },
    emptyText: {
      fontSize: mf(13),
      ...font.regular,
      color: C.textSecondary,
      paddingVertical: ms(8),
    },
    errorText: { fontSize: mf(13), ...font.regular, color: C.danger, paddingVertical: ms(8) },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: ms(10),
      paddingHorizontal: ms(12),
      borderRadius: ms(12),
      backgroundColor: C.surfaceSecondary,
      gap: ms(10),
    },
    rowInfo: { flex: 1, gap: ms(2) },
    rowLabel: { fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    rowMeta: { fontSize: mf(12), ...font.regular, color: C.textSecondary },
    iconBtn: { width: ms(44), height: ms(44), justifyContent: 'center', alignItems: 'center' },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      alignSelf: 'flex-start',
      minHeight: ms(44),
      paddingVertical: ms(8),
      paddingHorizontal: ms(14),
      marginTop: ms(4),
      borderRadius: ms(20),
      borderWidth: 1,
      borderColor: C.primary,
      backgroundColor: C.secondary,
    },
    addBtnText: { fontSize: mf(14), ...font.medium, color: C.primary },
  });
}
