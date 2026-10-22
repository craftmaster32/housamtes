import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { CategoryWords } from '@components/bills/CategoryWords';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { LineField } from '@components/parking/LineField';
import { useLanguageStore } from '@stores/languageStore';
import type { NewTaskInput, TaskPriority, TaskRecurrence } from '@stores/tasksStore';
import { getErrorMessage } from '@utils/errors';
import { parseDateParts, todayString } from '@utils/parkingDates';
import { MONTH_DAYS, WEEK_DAYS, defaultRepeatDay } from '@utils/taskRepeat';
import { mf, ms } from '@utils/responsive';
import { AssignPicker } from './AssignPicker';
import { CircledDays } from './CircledDays';
import { PriorityWords } from './PriorityWords';

interface TaskFormProps {
  onAdd: (input: NewTaskInput) => Promise<void>;
  myId: string;
}

/**
 * New task, written on lines: title, details, priority and repeat as circled
 * words (with the weekday / day of the month circled in pen), who it's for as
 * avatar circles, an optional due date that opens the pop-up calendar, and a
 * big blue "Add task".
 */
export function TaskForm({ onAdd, myId }: TaskFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('once');
  const [recurrenceDay, setRecurrenceDay] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [showDueDate, setShowDueDate] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const repeatWords = useMemo(
    () => [
      { key: 'once', label: t('tasks.once') },
      { key: 'weekly', label: t('tasks.weekly') },
      { key: 'monthly', label: t('tasks.monthly') },
    ],
    [t]
  );
  const weekDays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language, { weekday: 'short' });
    return WEEK_DAYS.map((key, i) => {
      const full = fmt.format(new Date(2024, 0, 7 + i));
      return {
        key,
        label: language.startsWith('he') ? full.replace(/^יום\s*/, '') : full.slice(0, 2),
        accessibilityLabel: full,
      };
    });
  }, [language]);
  const monthDays = useMemo(() => MONTH_DAYS.map((d) => ({ key: d, label: d })), []);

  const handleRepeat = useCallback((key: string): void => {
    const r = key as TaskRecurrence;
    setRecurrence(r);
    setRecurrenceDay(defaultRepeatDay(r));
  }, []);

  // "Add due date" shows the line (starting on today) and opens the calendar.
  const handleToggleDueDate = useCallback((): void => {
    if (showDueDate) {
      setShowDueDate(false);
      setDueDate('');
      return;
    }
    setShowDueDate(true);
    setDueDate(todayString());
    setPickingDate(true);
  }, [showDueDate]);
  const handleDatePicked = useCallback((d: string): void => {
    setDueDate(d);
    setPickingDate(false);
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
        recurrence,
        recurrenceDay,
      });
      setTitle('');
      setDescription('');
      setPriority('medium');
      setRecurrence('once');
      setRecurrenceDay(null);
      setAssignedTo(null);
      setDueDate('');
      setShowDueDate(false);
    } catch (err) {
      setAddError(getErrorMessage(err, t('tasks.failed_add')));
    } finally {
      setIsAdding(false);
    }
  }, [
    title,
    description,
    priority,
    assignedTo,
    dueDate,
    recurrence,
    recurrenceDay,
    isAdding,
    onAdd,
    t,
  ]);

  const due = dueDate ? parseDateParts(dueDate, language) : null;
  const dueLabel = due ? `${due.weekdayFull}, ${due.dayNum} ${due.monthShort}` : '';
  const canAdd = !!title.trim() && !isAdding;

  return (
    <View style={styles.form}>
      <UnderlineInput
        label={t('tasks.title_label')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('tasks.title_placeholder')}
        accessibilityLabel={t('tasks.title_label')}
        accessibilityHint={t('tasks.title_hint')}
        returnKeyType="done"
      />
      <UnderlineInput
        value={description}
        onChangeText={setDescription}
        placeholder={t('tasks.description_placeholder')}
        multiline
        accessibilityLabel={t('tasks.description_label')}
        accessibilityHint={t('tasks.description_hint')}
      />

      <View style={styles.wordsRow}>
        <Text style={[styles.label, { color: c.textSecondary }]}>{t('tasks.priority_label')}</Text>
        <View style={styles.flex}>
          <PriorityWords selected={priority} onSelect={setPriority} />
        </View>
      </View>
      <View style={styles.wordsRow}>
        <Text style={[styles.label, { color: c.textSecondary }]}>{t('tasks.repeat')}</Text>
        <View style={styles.flex}>
          <CategoryWords items={repeatWords} selected={recurrence} onSelect={handleRepeat} />
        </View>
      </View>
      {recurrence !== 'once' && (
        <View>
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {recurrence === 'weekly' ? t('tasks.which_day') : t('tasks.which_day_of_month')}
          </Text>
          <CircledDays
            items={recurrence === 'weekly' ? weekDays : monthDays}
            columns={7}
            selected={recurrenceDay}
            onSelect={setRecurrenceDay}
          />
        </View>
      )}

      <View>
        <Text style={[styles.label, styles.assignLabel, { color: c.textSecondary }]}>
          {t('tasks.assign_label')}
        </Text>
        <AssignPicker assignedTo={assignedTo} onChange={setAssignedTo} myId={myId} />
      </View>

      {showDueDate && (
        <View style={styles.dueField}>
          <LineField
            label={t('tasks.due_date')}
            value={dueLabel}
            icon="calendar-outline"
            onPress={() => setPickingDate(true)}
            accessibilityHint={t('common.pick_date')}
          />
        </View>
      )}
      <Pressable
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        onPress={handleToggleDueDate}
        accessible
        accessibilityRole="button"
      >
        <Text style={[styles.linkText, { color: c.primary }]}>
          {showDueDate ? t('tasks.remove_due_date') : t('tasks.add_due_date')}
        </Text>
      </Pressable>

      {!!addError && (
        <View style={styles.errorRow} accessibilityRole="alert">
          <Ionicons name="warning-outline" size={15} color={c.danger} />
          <Text style={[styles.errorText, { color: c.danger }]}>{addError}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: c.primary },
          (!canAdd || pressed) && styles.dimmed,
        ]}
        onPress={handleAdd}
        disabled={isAdding}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('tasks.add_task')}
        accessibilityState={{ disabled: !canAdd, busy: isAdding }}
      >
        <Text style={styles.btnText}>{isAdding ? t('tasks.adding') : t('tasks.add_task')}</Text>
      </Pressable>

      <DatePickerModal
        visible={pickingDate}
        value={dueDate || todayString()}
        onSelect={handleDatePicked}
        onClose={() => setPickingDate(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: ms(18), gap: ms(10) },
  flex: { flex: 1, minWidth: 0 },
  label: { fontSize: mf(13.5), ...font.bold },
  assignLabel: { marginBottom: ms(8) },
  dueField: { marginTop: ms(8) },
  wordsRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: mf(15), ...font.bold },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  errorText: { flex: 1, fontSize: mf(14), ...font.medium },
  btn: {
    minHeight: ms(52),
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: ms(4),
  },
  dimmed: { opacity: 0.5 },
  btnText: { color: '#FFFFFF', fontSize: mf(16), ...font.bold },
  pressed: { opacity: 0.7 },
});
