import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useChoresStore, type Chore, type Recurrence } from '@stores/choresStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import { resolveName } from '@utils/housemates';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

const SURFACE_BG = 'rgba(251,248,245,0.96)';
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
    return chore.recurrenceDay ? `Every ${localizedWeekDay(chore.recurrenceDay, language)}` : t('chores.weekly');
  if (chore.recurrence === 'monthly')
    return chore.recurrenceDay ? `${ordinal(chore.recurrenceDay)} ${t('chores.of_month')}` : t('chores.monthly');
  return null;
}

function ChoreRow({
  chore, myId, onToggle, onClaim, onUnclaim, onDelete,
}: {
  chore: Chore; myId: string;
  onToggle: (id: string) => void;
  onClaim: (id: string) => void;
  onUnclaim: (id: string) => void;
  onDelete: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);
  const isMineClaimed = chore.claimedBy === myId;
  const freq = freqLabel(chore, t, language);

  return (
    <View style={[styles.choreRow, chore.isComplete && styles.choreRowDone]}>
      <Pressable
        style={styles.checkBtn}
        onPress={() => onToggle(chore.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: chore.isComplete }}
      >
        <Ionicons
          name={chore.isComplete ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={chore.isComplete ? colors.positive : colors.border}
        />
      </Pressable>

      <View style={styles.choreInfo}>
        <Text style={[styles.choreName, chore.isComplete && styles.choreNameDone]} numberOfLines={1}>
          {chore.name}
        </Text>

        {freq && (
          <View style={styles.freqRow}>
            <Ionicons name="repeat-outline" size={12} color={colors.primary} />
            <Text style={styles.freqText}>{freq}</Text>
          </View>
        )}

        {chore.claimedBy ? (
          <View style={styles.claimedRow}>
            <View style={styles.claimedBadge}>
              <Ionicons name="person-outline" size={11} color={colors.primary} />
              <Text style={styles.claimedText}>
                {isMineClaimed ? 'You' : resolveName(chore.claimedBy ?? '', housemates)}
              </Text>
            </View>
            {isMineClaimed && (
              <Pressable onPress={() => onUnclaim(chore.id)} accessibilityRole="button">
                <Text style={styles.unclaimText}>{t('chores.drop')}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          !chore.isComplete && (
            <Pressable onPress={() => onClaim(chore.id)} accessibilityRole="button">
              <Text style={styles.claimBtnText}>{t('chores.take')}</Text>
            </Pressable>
          )
        )}
      </View>

      {(!chore.claimedBy || chore.claimedBy === myId) && (
        <Pressable onPress={() => onDelete(chore.id)} style={styles.deleteBtn} accessibilityRole="button" hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

export default function ChoresScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const chores = useChoresStore((state) => state.chores);
  const isLoading = useChoresStore((state) => state.isLoading);
  const storeError = useChoresStore((state) => state.error);
  const addChore = useChoresStore((state) => state.addChore);
  const toggleChore = useChoresStore((state) => state.toggleChore);
  const claimChore = useChoresStore((state) => state.claimChore);
  const unclaimChore = useChoresStore((state) => state.unclaimChore);
  const deleteChore = useChoresStore((state) => state.deleteChore);
  const resetAll = useChoresStore((state) => state.resetAll);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);
  const canReset = role === 'owner' || role === 'admin';
  const language = useLanguageStore((s) => s.language);

  const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
    { value: 'once', label: t('chores.once') },
    { value: 'weekly', label: t('chores.weekly') },
    { value: 'monthly', label: t('chores.monthly') },
  ];

  const weekDayLabels = useMemo(
    () => WEEK_DAYS.map((_, i) =>
      new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
    ),
    [language]
  );

  const myId = profile?.id ?? '';
  const [choreName, setChoreName] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [recurrenceDay, setRecurrenceDay] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const pending = chores.filter((c) => !c.isComplete);
  const done = chores.filter((c) => c.isComplete);
  const listData = [...pending, ...done];
  const progress = chores.length > 0 ? done.length / chores.length : 0;

  const handleRecurrenceChange = useCallback((r: Recurrence): void => {
    setRecurrence(r);
    if (r === 'weekly') {
      setRecurrenceDay(WEEK_DAYS[new Date().getDay()]);
    } else if (r === 'monthly') {
      setRecurrenceDay(String(new Date().getDate()));
    } else {
      setRecurrenceDay(null);
    }
  }, []);

  const handleAdd = useCallback(async (): Promise<void> => {
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

  const handleToggle = useCallback((id: string): void => { toggleChore(id); }, [toggleChore]);
  const handleClaim = useCallback((id: string): void => { claimChore(id, myId); }, [claimChore, myId]);
  const handleUnclaim = useCallback((id: string): void => { unclaimChore(id); }, [unclaimChore]);
  const handleDelete = useCallback((id: string): void => { deleteChore(id); }, [deleteChore]);

  const renderChore = useCallback(
    ({ item }: { item: Chore }): React.JSX.Element => (
      <ChoreRow
        chore={item} myId={myId}
        onToggle={handleToggle} onClaim={handleClaim}
        onUnclaim={handleUnclaim} onDelete={handleDelete}
      />
    ),
    [myId, handleToggle, handleClaim, handleUnclaim, handleDelete]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderChore}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}

        ListHeaderComponent={
          <View>
            {/* ── Hero card ──────────────────────────────────────── */}
            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <Text style={styles.titleHero}>{t('chores.title')}</Text>
                <Text style={styles.textBase}>
                  {"Assign tasks, claim what you'll do, and check them off together."}
                </Text>
              </View>

              {/* Progress bar */}
              {chores.length > 0 && (
                <View style={styles.progressSection}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>{done.length} of {chores.length} done</Text>
                    {done.length > 0 && canReset && (
                      <Pressable onPress={() => resetAll(houseId ?? '')} style={styles.resetBtn} accessibilityRole="button">
                        <Text style={styles.resetBtnText}>{t('chores.reset_all')}</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` as unknown as number }]} />
                  </View>
                </View>
              )}

              {/* Add form */}
              <TextInput
                value={choreName}
                onChangeText={setChoreName}
                placeholder={t('chores.chore_placeholder')}
                placeholderTextColor={colors.textSecondary}
                style={styles.formInput}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />

              {/* Recurrence */}
              <Text style={styles.pickerLabel}>{t('chores.repeat')}</Text>
              <View style={styles.chipRow}>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.chip, recurrence === opt.value && styles.chipActive]}
                    onPress={() => handleRecurrenceChange(opt.value)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, recurrence === opt.value && styles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {recurrence === 'weekly' && (
                <View style={styles.daySection}>
                  <Text style={styles.pickerLabel}>{t('chores.which_day')}</Text>
                  <View style={styles.weekDayRow}>
                    {WEEK_DAYS.map((day, i) => (
                      <Pressable
                        key={day}
                        style={[styles.weekDayChip, recurrenceDay === day && styles.weekDayChipActive]}
                        onPress={() => setRecurrenceDay(day)}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.weekDayText, recurrenceDay === day && styles.weekDayTextActive]}>
                          {weekDayLabels[i].slice(0, 2)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {recurrence === 'monthly' && (
                <View style={styles.daySection}>
                  <Text style={styles.pickerLabel}>{t('chores.which_day_of_month')}</Text>
                  <View style={styles.monthDayGrid}>
                    {MONTH_DAYS.map((d) => (
                      <Pressable
                        key={d}
                        style={[styles.monthDayChip, recurrenceDay === d && styles.monthDayChipActive]}
                        onPress={() => setRecurrenceDay(d)}
                        accessibilityRole="button"
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
                  <Ionicons name="warning-outline" size={14} color={colors.danger} />
                  <Text style={styles.errorText}>{addError}</Text>
                </View>
              )}

              <Pressable
                style={[styles.btnPrimary, (!choreName.trim() || isAdding) && styles.btnOff]}
                onPress={handleAdd}
                disabled={isAdding}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={16} color="#fff" style={styles.btnIcon} />
                <Text style={styles.btnPrimaryText}>
                  {isAdding ? t('chores.adding') : t('chores.add_chore')}
                </Text>
              </Pressable>
            </View>

            {isLoading && chores.length === 0 && (
              <ActivityIndicator size="small" color="#4F78B6" style={styles.loadingIndicator} />
            )}
            {!!storeError && (
              <View style={styles.storeErrorBox}>
                <Text style={styles.storeErrorText}>{storeError}</Text>
              </View>
            )}

            {pending.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.eyebrow}>{t('chores.todo')}</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{pending.length}</Text>
                </View>
              </View>
            )}
          </View>
        }

        ListFooterComponent={
          done.length > 0 ? (
            <View style={[styles.sectionHeader, { marginTop: 16 }]}>
              <Text style={styles.eyebrow}>{t('chores.done_section')}</Text>
              <View style={[styles.countPill, styles.countPillDone]}>
                <Text style={styles.countPillText}>{done.length}</Text>
              </View>
            </View>
          ) : null
        }

        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="checkmark-done-outline" size={36} color={colors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>{t('chores.no_chores')}</Text>
            <Text style={styles.emptyText}>{t('chores.no_chores_hint')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  sep: { height: 8 },

  // ── Hero card
  heroCard: {
    backgroundColor: SURFACE_BG,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 20, gap: 14, marginBottom: 24,
    boxShadow: '0 8px 24px rgba(44,51,61,0.05)',
  } as never,
  heroCopy: { gap: 6 },
  titleHero: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.78 },
  textBase: { fontSize: 15, ...font.regular, color: colors.textSecondary, lineHeight: 22 },

  // Progress
  progressSection: { gap: 8 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  resetBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9999, backgroundColor: colors.surfaceSecondary },
  resetBtnText: { fontSize: 12, ...font.semibold, color: colors.textSecondary },
  progressTrack: { height: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.positive, borderRadius: 3 },

  // Add form
  formInput: {
    height: 46, backgroundColor: colors.white, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13,
    fontSize: 15, ...font.regular, color: colors.textPrimary,
  },

  // Recurrence
  pickerLabel: {
    fontSize: 11, ...font.bold, color: colors.textSecondary,
    letterSpacing: 0.72, textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },

  daySection: { gap: 8 },
  weekDayRow: { flexDirection: 'row', gap: 6 },
  weekDayChip: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  weekDayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekDayText: { fontSize: 12, ...font.bold, color: colors.textSecondary },
  weekDayTextActive: { color: '#fff' },
  monthDayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthDayChip: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  monthDayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthDayText: { fontSize: 12, ...font.bold, color: colors.textSecondary },
  monthDayTextActive: { color: '#fff' },

  // Buttons
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: colors.primary,
    boxShadow: '0 8px 16px rgba(79,120,182,0.18)',
  } as never,
  btnOff: { backgroundColor: colors.textDisabled, boxShadow: 'none' } as never,
  btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#fff' },
  btnIcon: { marginRight: 6 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 4, marginBottom: 10,
  },
  eyebrow: { fontSize: 12, ...font.bold, color: colors.textSecondary, letterSpacing: 0.72, textTransform: 'uppercase' },
  countPill: {
    minHeight: 22, paddingHorizontal: 8, borderRadius: 9999,
    backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center',
  },
  countPillDone: { backgroundColor: colors.positive + '20' },
  countPillText: { fontSize: 11, ...font.bold, color: colors.secondaryForeground },

  // Chore row
  choreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(44,51,61,0.02)',
  } as never,
  choreRowDone: { backgroundColor: 'rgba(251,248,245,0.4)', borderColor: 'transparent', boxShadow: 'none' } as never,
  checkBtn: { flexShrink: 0 },
  choreInfo: { flex: 1, gap: 4 },
  choreName: { fontSize: 15, ...font.semibold, color: colors.textPrimary },
  choreNameDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  freqRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  freqText: { fontSize: 12, ...font.medium, color: colors.primary },
  claimedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  claimedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary + '18', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 9999,
  },
  claimedText: { fontSize: 12, ...font.bold, color: colors.primary },
  unclaimText: { fontSize: 12, ...font.regular, color: colors.textSecondary },
  claimBtnText: { fontSize: 13, ...font.semibold, color: colors.primary },
  deleteBtn: { padding: 4, flexShrink: 0 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  emptyText: { fontSize: 14, ...font.regular, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  loadingIndicator: { marginBottom: 8 },
  storeErrorBox: {
    backgroundColor: '#FFF0F0', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  storeErrorText: { fontSize: 13, color: '#D94F4F' },

  // Error
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.danger + '15', borderRadius: 10, padding: 10,
  },
  errorText: { fontSize: 13, ...font.regular, color: colors.danger, flex: 1 },
});
