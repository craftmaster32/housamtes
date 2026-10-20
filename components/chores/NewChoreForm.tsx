import { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { CategoryWords } from '@components/bills/CategoryWords';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { useLanguageStore } from '@stores/languageStore';
import type { Recurrence } from '@stores/choresStore';
import { MONTH_DAYS, WEEK_DAYS } from '@utils/choreLabels';
import { mf, ms } from '@utils/responsive';
import { CircledDays } from './CircledDays';

interface NewChoreFormProps {
  name: string;
  onNameChange: (name: string) => void;
  recurrence: Recurrence;
  onRecurrenceChange: (r: Recurrence) => void;
  recurrenceDay: string | null;
  onRecurrenceDayChange: (day: string) => void;
  isAdding: boolean;
  error: string;
  onAdd: () => void;
}

/**
 * "New chore": the name written on a line, Repeat as hand-circled words, the
 * weekday or day of the month circled in pen, and a big blue "Add chore".
 */
export function NewChoreForm({
  name,
  onNameChange,
  recurrence,
  onRecurrenceChange,
  recurrenceDay,
  onRecurrenceDayChange,
  isAdding,
  error,
  onAdd,
}: NewChoreFormProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const language = useLanguageStore((s) => s.language);

  const repeatWords = useMemo(
    () => [
      { key: 'once', label: t('chores.once') },
      { key: 'weekly', label: t('chores.weekly') },
      { key: 'monthly', label: t('chores.monthly') },
    ],
    [t]
  );
  const weekDays = useMemo(
    () =>
      WEEK_DAYS.map((key, i) => ({
        key,
        label: new Intl.DateTimeFormat(language, { weekday: 'short' })
          .format(new Date(2024, 0, 7 + i))
          .slice(0, 2),
      })),
    [language]
  );
  const monthDays = useMemo(() => MONTH_DAYS.map((d) => ({ key: d, label: d })), []);
  const canAdd = !!name.trim() && !isAdding;

  return (
    <View style={styles.form}>
      <UnderlineInput
        label={t('chores.new_chore')}
        value={name}
        onChangeText={onNameChange}
        placeholder={t('chores.chore_placeholder')}
        accessibilityLabel={t('chores.chore_name_label')}
        accessibilityHint={t('chores.chore_name_hint')}
        returnKeyType="done"
        onSubmitEditing={onAdd}
      />

      <View style={styles.repeatRow}>
        <Text style={[styles.label, { color: c.textSecondary }]}>{t('chores.repeat')}</Text>
        <View style={styles.repeatWords}>
          <CategoryWords
            items={repeatWords}
            selected={recurrence}
            onSelect={(key) => onRecurrenceChange(key as Recurrence)}
          />
        </View>
      </View>

      {recurrence === 'weekly' && (
        <View>
          <Text style={[styles.label, { color: c.textSecondary }]}>{t('chores.which_day')}</Text>
          <CircledDays
            items={weekDays}
            columns={7}
            selected={recurrenceDay}
            onSelect={onRecurrenceDayChange}
          />
        </View>
      )}
      {recurrence === 'monthly' && (
        <View>
          <Text style={[styles.label, { color: c.textSecondary }]}>
            {t('chores.which_day_of_month')}
          </Text>
          <CircledDays
            items={monthDays}
            columns={7}
            selected={recurrenceDay}
            onSelect={onRecurrenceDayChange}
          />
        </View>
      )}

      {!!error && (
        <View style={styles.errorRow} accessibilityRole="alert">
          <Ionicons name="warning-outline" size={15} color={c.danger} />
          <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: c.primary },
          (!canAdd || pressed) && styles.dimmed,
        ]}
        onPress={onAdd}
        disabled={isAdding}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd, busy: isAdding }}
      >
        <Text style={styles.btnText}>{isAdding ? t('chores.adding') : t('chores.add_chore')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: ms(22), gap: ms(12) },
  label: { fontSize: mf(13.5), ...font.bold },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
  repeatWords: { flex: 1, minWidth: 0 },
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
});
