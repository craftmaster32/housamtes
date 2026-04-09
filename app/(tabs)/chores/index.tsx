import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useChoresStore, type Chore, type Recurrence } from '@stores/choresStore';
import { useAuthStore } from '@stores/authStore';
import { useLanguageStore } from '@stores/languageStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

function ordinal(n: string): string {
  const num = parseInt(n, 10);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function localizedWeekDay(englishDay: string, language: string): string {
  const idx = WEEK_DAYS.indexOf(englishDay);
  if (idx < 0) return englishDay;
  return new Intl.DateTimeFormat(language, { weekday: 'long' }).format(new Date(2024, 0, 7 + idx));
}

function freqLabel(chore: Chore, t: (key: string, opts?: Record<string, unknown>) => string, language: string): string | null {
  if (chore.recurrence === 'once') return null;
  if (chore.recurrence === 'weekly')
    return chore.recurrenceDay ? `${t('chores.every')} ${localizedWeekDay(chore.recurrenceDay, language)}` : t('chores.weekly');
  if (chore.recurrence === 'monthly')
    return chore.recurrenceDay ? `${ordinal(chore.recurrenceDay)} ${t('chores.of_month')}` : t('chores.monthly');
  return null;
}

function formatAddedDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function ChoreRow({
  chore, myName, onToggle, onClaim, onUnclaim, onDelete,
}: {
  chore: Chore; myName: string;
  onToggle: (id: string) => void;
  onClaim: (id: string) => void;
  onUnclaim: (id: string) => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const isMineClaimed = chore.claimedBy === myName;
  const freq = freqLabel(chore, t, language);

  return (
    <View style={styles.choreRow}>
      <Pressable
        style={[styles.checkbox, chore.isComplete && styles.checkboxDone]}
        onPress={() => onToggle(chore.id)}
      >
        {chore.isComplete && <Text style={styles.checkmark}>✓</Text>}
      </Pressable>

      <View style={styles.choreInfo}>
        <Text style={[styles.choreName, chore.isComplete && styles.choreNameDone]}>
          {chore.name}
        </Text>

        <Text style={styles.choreAdded}>{t('chores.added')} {formatAddedDate(chore.createdAt)}</Text>

        {chore.claimedBy ? (
          <View style={styles.claimedRow}>
            <View style={styles.claimedBadge}>
              <Text style={styles.claimedText}>
                {isMineClaimed ? t('chores.you') : `✋ ${chore.claimedBy}`}
              </Text>
            </View>
            {isMineClaimed && (
              <Pressable onPress={() => onUnclaim(chore.id)}>
                <Text style={styles.unclaimText}>{t('chores.drop')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable onPress={() => onClaim(chore.id)} style={styles.claimBtn}>
            <Text style={styles.claimBtnText}>{t('chores.take')}</Text>
          </Pressable>
        )}
      </View>

      {freq !== null && (
        <View style={styles.freqBadge}>
          <Text style={styles.freqBadgeText}>🔁</Text>
          <Text style={styles.freqBadgeLabel}>{freq}</Text>
        </View>
      )}

      <Pressable onPress={() => onDelete(chore.id)} style={styles.deleteBtn}>
        <Text style={styles.deleteBtnText}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function ChoresScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const chores = useChoresStore((state) => state.chores);
  const addChore = useChoresStore((state) => state.addChore);
  const toggleChore = useChoresStore((state) => state.toggleChore);
  const claimChore = useChoresStore((state) => state.claimChore);
  const unclaimChore = useChoresStore((state) => state.unclaimChore);
  const deleteChore = useChoresStore((state) => state.deleteChore);
  const resetAll = useChoresStore((state) => state.resetAll);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);

  const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
    { value: 'once', label: t('chores.once') },
    { value: 'weekly', label: t('chores.weekly') },
    { value: 'monthly', label: t('chores.monthly') },
  ];

  const language = useLanguageStore((s) => s.language);
  const weekDayLabels = useMemo(
    () => WEEK_DAYS.map((_, i) =>
      new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
    ),
    [language]
  );

  const myName = profile?.name ?? '';
  const [choreName, setChoreName] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [recurrenceDay, setRecurrenceDay] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const pending = chores.filter((c) => !c.isComplete);
  const done = chores.filter((c) => c.isComplete);
  const listData = [...pending, ...done];

  const handleRecurrenceChange = useCallback((r: Recurrence) => {
    setRecurrence(r);
    if (r === 'weekly') {
      setRecurrenceDay(WEEK_DAYS[new Date().getDay()]);
    } else if (r === 'monthly') {
      setRecurrenceDay(String(new Date().getDate()));
    } else {
      setRecurrenceDay(null);
    }
  }, []);

  const handleAdd = useCallback(async () => {
    if (!choreName.trim() || isAdding) return;
    setIsAdding(true);
    setAddError('');
    try {
      await addChore(choreName.trim(), recurrence, recurrenceDay, houseId ?? '');
      setChoreName('');
      setRecurrence('once');
      setRecurrenceDay(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t('chores.failed_add'));
    } finally {
      setIsAdding(false);
    }
  }, [choreName, recurrence, recurrenceDay, addChore, houseId, isAdding, t]);

  const handleToggle = useCallback((id: string) => { toggleChore(id); }, [toggleChore]);
  const handleClaim = useCallback((id: string) => { claimChore(id, myName); }, [claimChore, myName]);
  const handleUnclaim = useCallback((id: string) => { unclaimChore(id); }, [unclaimChore]);
  const handleDelete = useCallback((id: string) => { deleteChore(id); }, [deleteChore]);

  const renderChore = useCallback(
    ({ item }: { item: Chore }) => (
      <ChoreRow
        chore={item} myName={myName}
        onToggle={handleToggle} onClaim={handleClaim}
        onUnclaim={handleUnclaim} onDelete={handleDelete}
      />
    ),
    [myName, handleToggle, handleClaim, handleUnclaim, handleDelete]
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderChore}
        ListHeaderComponent={
          <View>
            <View style={styles.headerRow}>
              <Text style={styles.heading}>{t('chores.title')}</Text>
              {done.length > 0 && (
                <Pressable onPress={() => resetAll(houseId ?? '')} style={styles.resetBtn}>
                  <Text style={styles.resetBtnText}>{t('chores.reset_all')}</Text>
                </Pressable>
              )}
            </View>

            {chores.length > 0 && (
              <View style={styles.progressSection}>
                <Text style={styles.progressLabel}>{t('chores.done_other', { count: done.length })}/{chores.length}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(done.length / chores.length) * 100}%` as unknown as number }]} />
                </View>
              </View>
            )}

            {/* Chore name */}
            <View style={styles.addRow}>
              <TextInput
                label={t('chores.new_chore')}
                value={choreName}
                onChangeText={setChoreName}
                mode="outlined"
                style={styles.nameInput}
                placeholder={t('chores.chore_placeholder')}
                autoCorrect={true}
              />
            </View>

            {/* Recurrence type */}
            <Text style={styles.pickerLabel}>{t('chores.repeat')}</Text>
            <View style={styles.recurrenceRow}>
              {RECURRENCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.recurrenceChip, recurrence === opt.value && styles.recurrenceChipActive]}
                  onPress={() => handleRecurrenceChange(opt.value)}
                >
                  <Text style={[styles.recurrenceChipText, recurrence === opt.value && styles.recurrenceChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Weekly: pick day of week */}
            {recurrence === 'weekly' && (
              <View style={styles.dayPickerSection}>
                <Text style={styles.pickerLabel}>{t('chores.which_day')}</Text>
                <View style={styles.weekDayRow}>
                  {WEEK_DAYS.map((day, i) => (
                    <Pressable
                      key={day}
                      style={[styles.weekDayChip, recurrenceDay === day && styles.weekDayChipActive]}
                      onPress={() => setRecurrenceDay(day)}
                    >
                      <Text style={[styles.weekDayText, recurrenceDay === day && styles.weekDayTextActive]}>
                        {weekDayLabels[i].slice(0, 2)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Monthly: pick day of month */}
            {recurrence === 'monthly' && (
              <View style={styles.dayPickerSection}>
                <Text style={styles.pickerLabel}>{t('chores.which_day_of_month')}</Text>
                <View style={styles.monthDayGrid}>
                  {MONTH_DAYS.map((d) => (
                    <Pressable
                      key={d}
                      style={[styles.monthDayChip, recurrenceDay === d && styles.monthDayChipActive]}
                      onPress={() => setRecurrenceDay(d)}
                    >
                      <Text style={[styles.monthDayText, recurrenceDay === d && styles.monthDayTextActive]}>
                        {d}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {!!addError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{addError}</Text>
              </View>
            )}

            {/* Add button */}
            <Pressable
              style={[styles.addBtn, (!choreName.trim() || isAdding) && styles.addBtnDisabled]}
              onPress={handleAdd}
              disabled={isAdding}
            >
              <Text style={styles.addBtnText}>{isAdding ? t('chores.adding') : t('chores.add_chore')}</Text>
            </Pressable>

            {pending.length > 0 && (
              <Text style={[styles.sectionLabel, { marginTop: sizes.lg }]}>{t('chores.todo')} ({pending.length})</Text>
            )}
          </View>
        }
        ListFooterComponent={done.length > 0 ? (
          <Text style={[styles.sectionLabel, { marginTop: sizes.md }]}>{t('chores.done_section')} ({done.length})</Text>
        ) : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('chores.no_chores')}</Text>
            <Text style={styles.emptyText}>{t('chores.no_chores_hint')}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: sizes.lg, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sizes.sm },
  heading: { color: colors.textPrimary, ...font.extrabold, fontSize: 26, letterSpacing: -0.5 },
  resetBtn: { backgroundColor: colors.border, paddingVertical: 4, paddingHorizontal: sizes.sm, borderRadius: sizes.borderRadiusFull },
  resetBtnText: { color: colors.textSecondary, fontSize: 15, ...font.semibold },
  progressSection: { marginBottom: sizes.md },
  progressLabel: { color: colors.textSecondary, fontSize: 15, ...font.regular, marginBottom: sizes.xs },
  progressTrack: { height: 6, backgroundColor: colors.border, borderRadius: sizes.borderRadiusFull, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.positive, borderRadius: sizes.borderRadiusFull },
  addRow: { marginBottom: sizes.sm },
  nameInput: { backgroundColor: colors.white },
  pickerLabel: { color: colors.textSecondary, fontSize: 12, ...font.semibold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: sizes.xs, marginTop: sizes.sm },
  recurrenceRow: { flexDirection: 'row', gap: sizes.sm, marginBottom: sizes.xs },
  recurrenceChip: { paddingHorizontal: sizes.md, paddingVertical: 7, borderRadius: sizes.borderRadiusFull, backgroundColor: colors.border },
  recurrenceChipActive: { backgroundColor: colors.primary },
  recurrenceChipText: { color: colors.textSecondary, fontSize: 15, ...font.semibold },
  recurrenceChipTextActive: { color: colors.white },
  dayPickerSection: { marginTop: sizes.xs, marginBottom: sizes.xs },
  weekDayRow: { flexDirection: 'row', gap: sizes.xs },
  weekDayChip: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  weekDayChipActive: { backgroundColor: colors.primary },
  weekDayText: { color: colors.textSecondary, fontSize: 15, ...font.bold },
  weekDayTextActive: { color: colors.white },
  monthDayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  monthDayChip: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  monthDayChipActive: { backgroundColor: colors.primary },
  monthDayText: { color: colors.textSecondary, fontSize: 12, ...font.bold },
  monthDayTextActive: { color: colors.white },
  addBtn: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: sizes.md,
    borderCurve: 'continuous',
  } as never,
  addBtnDisabled: { backgroundColor: colors.textDisabled },
  addBtnText: { color: colors.white, ...font.bold, fontSize: 15 },
  errorBox: { backgroundColor: colors.danger + '15', borderRadius: 10, padding: sizes.sm },
  errorText: { color: colors.danger, fontSize: 13, ...font.regular },
  sectionLabel: { color: colors.textSecondary, fontSize: 12, ...font.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: sizes.sm },
  choreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.md,
    gap: sizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  checkboxDone: { backgroundColor: colors.positive, borderColor: colors.positive },
  checkmark: { color: colors.white, fontSize: 13, ...font.bold },
  choreInfo: { flex: 1, gap: 3 },
  choreName: { color: colors.textPrimary, fontSize: 15, ...font.medium },
  choreNameDone: { textDecorationLine: 'line-through', color: colors.textDisabled },
  choreAdded: { fontSize: 12, color: colors.textSecondary, ...font.regular, marginTop: 1 },
  claimedRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs },
  claimedBadge: { backgroundColor: colors.primary + '18', paddingHorizontal: sizes.xs, paddingVertical: 2, borderRadius: sizes.borderRadiusFull },
  claimedText: { color: colors.primary, fontSize: 12, ...font.bold },
  unclaimText: { color: colors.textSecondary, fontSize: 12, ...font.regular },
  claimBtn: { alignSelf: 'flex-start' },
  claimBtnText: { color: colors.primary, fontSize: 15, ...font.semibold },
  freqBadge: { backgroundColor: colors.primary + '15', borderRadius: sizes.borderRadiusFull, paddingHorizontal: sizes.sm, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  freqBadgeText: { fontSize: 13 },
  freqBadgeLabel: { fontSize: 15, color: colors.primary, ...font.bold },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: colors.textSecondary, fontSize: 15, ...font.regular },
  separator: { height: sizes.xs },
  empty: { alignItems: 'center', paddingTop: sizes.xxl },
  emptyTitle: { color: colors.textPrimary, ...font.bold, fontSize: 15, marginBottom: sizes.xs },
  emptyText: { color: colors.textSecondary, ...font.regular, fontSize: 15, textAlign: 'center' },
});
