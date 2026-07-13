import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NewTaskInput, TaskPriority } from '@stores/tasksStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { DateInput } from '@components/shared/DateInput';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { getErrorMessage } from '@utils/errors';

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];

interface AddTaskFormProps {
  onAdd: (input: NewTaskInput) => Promise<void>;
}

export function AddTaskForm({ onAdd }: AddTaskFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((s) => s.housemates);
  const myId = useAuthStore((s) => s.profile?.id) ?? '';
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [showDueDate, setShowDueDate] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const handleToggleDueDate = useCallback((): void => {
    setShowDueDate((prev) => {
      if (prev) setDueDate('');
      return !prev;
    });
  }, []);

  const handleAdd = useCallback(async (): Promise<void> => {
    if (!title.trim() || isAdding) return;
    setIsAdding(true);
    setAddError('');
    try {
      await onAdd({
        title: title.trim(),
        description: description.trim(),
        priority,
        assignedTo,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setAssignedTo(null);
      setDueDate('');
      setShowDueDate(false);
    } catch (err) {
      setAddError(getErrorMessage(err, t('tasks.failed_add')));
    } finally {
      setIsAdding(false);
    }
  }, [title, description, priority, assignedTo, dueDate, isAdding, onAdd, t]);

  return (
    <View style={styles.form}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('tasks.title_placeholder')}
        placeholderTextColor={C.textSecondary}
        style={styles.input}
        returnKeyType="done"
        accessibilityLabel={t('tasks.title_label')}
        accessibilityHint={t('tasks.title_hint')}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder={t('tasks.description_placeholder')}
        placeholderTextColor={C.textSecondary}
        style={[styles.input, styles.inputMultiline]}
        multiline
        accessibilityLabel={t('tasks.description_label')}
        accessibilityHint={t('tasks.description_hint')}
      />

      <Text style={styles.pickerLabel}>{t('tasks.priority_label')}</Text>
      <View style={styles.chipRow}>
        {PRIORITIES.map((p) => (
          <Pressable
            key={p}
            style={[styles.chip, priority === p && styles.chipActive]}
            onPress={() => setPriority(p)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={t(`tasks.priority_${p}`)}
            accessibilityState={{ selected: priority === p }}
          >
            <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>
              {t(`tasks.priority_${p}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.pickerLabel}>{t('tasks.assign_label')}</Text>
      <View style={styles.chipRow}>
        <Pressable
          style={[styles.chip, assignedTo === null && styles.chipActive]}
          onPress={() => setAssignedTo(null)}
          accessible
          accessibilityRole="radio"
          accessibilityLabel={t('tasks.assign_nobody')}
          accessibilityState={{ selected: assignedTo === null }}
        >
          <Text style={[styles.chipText, assignedTo === null && styles.chipTextActive]}>
            {t('tasks.assign_nobody')}
          </Text>
        </Pressable>
        {housemates.map((h) => (
          <Pressable
            key={h.id}
            style={[styles.chip, assignedTo === h.id && styles.chipActive]}
            onPress={() => setAssignedTo(h.id)}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={h.name}
            accessibilityState={{ selected: assignedTo === h.id }}
          >
            <Text style={[styles.chipText, assignedTo === h.id && styles.chipTextActive]}>
              {h.id === myId ? t('tasks.assign_me') : h.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.dueToggle}
        onPress={handleToggleDueDate}
        accessible
        accessibilityRole="button"
        accessibilityLabel={showDueDate ? t('tasks.remove_due_date') : t('tasks.add_due_date')}
      >
        <Ionicons
          name={showDueDate ? 'close-circle-outline' : 'calendar-outline'}
          size={16}
          color={C.primary}
        />
        <Text style={styles.dueToggleText}>
          {showDueDate ? t('tasks.remove_due_date') : t('tasks.add_due_date')}
        </Text>
      </Pressable>
      {showDueDate && <DateInput value={dueDate} onChange={setDueDate} />}

      {!!addError && (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={14} color={C.danger} />
          <Text style={styles.errorText}>{addError}</Text>
        </View>
      )}

      <Pressable
        style={[styles.btnPrimary, (!title.trim() || isAdding) && styles.btnOff]}
        onPress={handleAdd}
        disabled={isAdding}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('tasks.add_task')}
        accessibilityState={{ disabled: !title.trim() || isAdding }}
      >
        <Ionicons name="add" size={16} color="#fff" style={styles.btnIcon} />
        <Text style={styles.btnPrimaryText}>
          {isAdding ? t('tasks.adding') : t('tasks.add_task')}
        </Text>
      </Pressable>
    </View>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    form: { gap: 12 },
    input: {
      minHeight: 46,
      backgroundColor: C.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 13,
      paddingVertical: 12,
      fontSize: 15,
      ...font.regular,
      color: C.textPrimary,
    },
    inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
    pickerLabel: {
      fontSize: 11,
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.72,
      textTransform: 'uppercase',
    },
    chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: 'center',
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
    },
    chipActive: { backgroundColor: C.primary, borderColor: C.primary },
    chipText: { fontSize: 13, ...font.semibold, color: C.textSecondary },
    chipTextActive: { color: '#fff' },
    dueToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      alignSelf: 'flex-start',
    },
    dueToggleText: { fontSize: 13, ...font.semibold, color: C.primary },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.danger + '15',
      borderRadius: 10,
      padding: 10,
    },
    errorText: { fontSize: 13, ...font.regular, color: C.danger, flex: 1 },
    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: C.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    btnOff: { backgroundColor: C.textDisabled },
    btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
    btnIcon: { marginEnd: 6 },
  });
}
