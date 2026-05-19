// app/(tabs)/chores/index.tsx
// Chores — v2 redesign.
// Same data flow as v1 (useChoresStore, useAuthStore, useHousematesStore,
// useLanguageStore). Same claim/unclaim/toggle/delete handlers. New: blue hero
// card with count-up + spring progress bar, dark theme via useThemedColors,
// `type` ladder, `Header` UI primitive, fade-up entrance, press scale on chips
// + day cells, LinearTransition on chore rows, haptics throughout.

import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useChoresStore, type Chore, type Recurrence } from '@stores/choresStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useLanguageStore } from '@stores/languageStore';
import { resolveName } from '@utils/housemates';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { Button, EmptyState, Header } from '@components/ui';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import {
  useFadeInUp, usePressScale, useSpringBar, useCountUp, useHaptic,
} from '@utils/animations';

const WEEK_DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

function freqLabel(
  chore: Chore,
  t: (key: string, opts?: Record<string, unknown>) => string,
  language: string,
): string | null {
  if (chore.recurrence === 'once') return null;
  if (chore.recurrence === 'weekly')
    return chore.recurrenceDay ? `Every ${localizedWeekDay(chore.recurrenceDay, language)}` : t('chores.weekly');
  if (chore.recurrence === 'monthly')
    return chore.recurrenceDay ? `${ordinal(chore.recurrenceDay)} ${t('chores.of_month')}` : t('chores.monthly');
  return null;
}

// ── Chore row ────────────────────────────────────────────────────────────────
function ChoreRow({
  chore, myId, onToggle, onClaim, onUnclaim, onDelete, C,
}: {
  chore: Chore; myId: string;
  onToggle: (id: string) => void;
  onClaim: (id: string) => void;
  onUnclaim: (id: string) => void;
  onDelete: (id: string) => void;
  C: ColorTokens;
}): React.JSX.Element {
  const { t } = useTranslation();
  const language = useLanguageStore((s) => s.language);
  const housemates = useHousematesStore((s) => s.housemates);
  const haptic = useHaptic();
  const isMineClaimed = chore.claimedBy === myId;
  const freq = freqLabel(chore, t, language);
  const styles = useMemo(() => makeStyles(C), [C]);
  const press = usePressScale(0.985);

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(18)}
      style={[styles.choreRow, press.animatedStyle, chore.isComplete && styles.choreRowDone]}
    >
      <Pressable
        style={styles.checkBtn}
        onPress={() => { if (!chore.isComplete) haptic.success(); onToggle(chore.id); }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: chore.isComplete }}
        hitSlop={6}
      >
        <Ionicons
          name={chore.isComplete ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={chore.isComplete ? C.positive : C.border}
        />
      </Pressable>

      <View style={styles.choreInfo}>
        <Text
          style={[
            type.label,
            { color: chore.isComplete ? C.textSecondary : C.textPrimary },
            chore.isComplete && { textDecorationLine: 'line-through' },
          ]}
          numberOfLines={1}
        >
          {chore.name}
        </Text>

        {freq && (
          <View style={styles.freqRow}>
            <Ionicons name="repeat-outline" size={12} color={C.primary} />
            <Text style={[type.captionMed, { color: C.primary }]}>{freq}</Text>
          </View>
        )}

        {chore.claimedBy ? (
          <View style={styles.claimedRow}>
            <View style={[styles.claimedBadge, { backgroundColor: C.primary + '18' }]}>
              <Ionicons name="person-outline" size={11} color={C.primary} />
              <Text style={[type.captionMed, { color: C.primary, fontWeight: '700' }]}>
                {isMineClaimed ? 'You' : resolveName(chore.claimedBy ?? '', housemates)}
              </Text>
            </View>
            {isMineClaimed && (
              <TextLink onPress={() => { haptic.tap(); onUnclaim(chore.id); }} color={C.textSecondary}>
                {t('chores.drop')}
              </TextLink>
            )}
          </View>
        ) : (
          !chore.isComplete && (
            <TextLink onPress={() => { haptic.tap(); onClaim(chore.id); }} color={C.primary}>
              {t('chores.take')}
            </TextLink>
          )
        )}
      </View>

      {(!chore.claimedBy || chore.claimedBy === myId) && (
        <Pressable
          onPress={() => onDelete(chore.id)}
          style={styles.deleteBtn}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={C.textSecondary} />
        </Pressable>
      )}
    </Animated.View>
  );
}

function TextLink({ children, onPress, color }: { children: React.ReactNode; onPress: () => void; color: string }): React.JSX.Element {
  const press = usePressScale(0.94);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={6}
        accessibilityRole="button"
      >
        <Text style={[type.labelSm, { color }]}>{children}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ChoresScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const haptic = useHaptic();

  const chores       = useChoresStore((state) => state.chores);
  const isLoading    = useChoresStore((state) => state.isLoading);
  const storeError   = useChoresStore((state) => state.error);
  const addChore     = useChoresStore((state) => state.addChore);
  const toggleChore  = useChoresStore((state) => state.toggleChore);
  const claimChore   = useChoresStore((state) => state.claimChore);
  const unclaimChore = useChoresStore((state) => state.unclaimChore);
  const deleteChore  = useChoresStore((state) => state.deleteChore);
  const resetAll     = useChoresStore((state) => state.resetAll);
  const profile      = useAuthStore((s) => s.profile);
  const houseId      = useAuthStore((s) => s.houseId);
  const role         = useAuthStore((s) => s.role);
  const canReset     = role === 'owner' || role === 'admin';
  const language     = useLanguageStore((s) => s.language);

  const fadeStyle = useFadeInUp(0);

  const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
    { value: 'once',    label: t('chores.once') },
    { value: 'weekly',  label: t('chores.weekly') },
    { value: 'monthly', label: t('chores.monthly') },
  ];

  const weekDayLabels = useMemo(
    () => WEEK_DAYS.map((_, i) =>
      new Intl.DateTimeFormat(language, { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
    ),
    [language]
  );

  const myId = profile?.id ?? '';
  const [choreName, setChoreName]         = useState('');
  const [recurrence, setRecurrence]       = useState<Recurrence>('once');
  const [recurrenceDay, setRecurrenceDay] = useState<string | null>(null);
  const [isAdding, setIsAdding]           = useState(false);
  const [addError, setAddError]           = useState('');

  const pending  = chores.filter((c) => !c.isComplete);
  const done     = chores.filter((c) => c.isComplete);
  const listData = [...pending, ...done];

  // Spring-animated progress bar + count-up "done" count.
  const progressBar = useSpringBar(done.length, Math.max(1, chores.length), { delay: 120 });
  const doneDisplay = useCountUp(done.length, { duration: 600, formatter: (n) => Math.round(n).toString() });

  const handleRecurrenceChange = useCallback((r: Recurrence): void => {
    haptic.tap();
    setRecurrence(r);
    if (r === 'weekly')      setRecurrenceDay(WEEK_DAYS[new Date().getDay()]);
    else if (r === 'monthly') setRecurrenceDay(String(new Date().getDate()));
    else                      setRecurrenceDay(null);
  }, [haptic]);

  const handleAdd = useCallback(async (): Promise<void> => {
    if (!choreName.trim() || isAdding) return;
    setIsAdding(true); setAddError('');
    try {
      await addChore(choreName.trim(), recurrence, recurrenceDay, houseId ?? '');
      haptic.success();
      setChoreName(''); setRecurrence('once'); setRecurrenceDay(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t('chores.failed_add'));
    } finally {
      setIsAdding(false);
    }
  }, [choreName, recurrence, recurrenceDay, addChore, houseId, isAdding, t, haptic]);

  const handleToggle  = useCallback((id: string): void => { toggleChore(id); }, [toggleChore]);
  const handleClaim   = useCallback((id: string): void => { claimChore(id, myId); }, [claimChore, myId]);
  const handleUnclaim = useCallback((id: string): void => { unclaimChore(id); }, [unclaimChore]);
  const handleDelete  = useCallback((id: string): void => { haptic.warn(); deleteChore(id); }, [deleteChore, haptic]);

  const renderChore = useCallback(
    ({ item }: { item: Chore }): React.JSX.Element => (
      <ChoreRow
        chore={item} myId={myId}
        onToggle={handleToggle} onClaim={handleClaim}
        onUnclaim={handleUnclaim} onDelete={handleDelete}
        C={C}
      />
    ),
    [myId, handleToggle, handleClaim, handleUnclaim, handleDelete, C]
  );

  const handleResetAll = useCallback(() => { haptic.warn(); resetAll(houseId ?? ''); }, [haptic, resetAll, houseId]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <Header title={t('chores.title')} />
      <Animated.View style={[styles.flex, fadeStyle]}>
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderChore}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}

          ListHeaderComponent={
            <View>
              {/* ── Blue hero with progress bar ────────────────────── */}
              <View style={styles.heroCard}>
                <View style={styles.heroDeco} />
                <View style={styles.heroDecoSm} />

                <View style={styles.heroTopRow}>
                  <View style={styles.heroIcon}>
                    <Ionicons name="checkmark-done-outline" size={26} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.eyebrow, { color: 'rgba(255,255,255,0.78)' }]}>House chores</Text>
                    <Text style={[type.title, { color: '#fff' }]}>
                      {chores.length === 0 ? 'No chores yet' : `${doneDisplay} of ${chores.length} done`}
                    </Text>
                  </View>
                </View>

                {chores.length > 0 && (
                  <View style={styles.heroProgress}>
                    <View style={styles.heroProgressTrack}>
                      <Animated.View style={[styles.heroProgressFill, progressBar.animatedStyle]} />
                    </View>
                    {done.length > 0 && canReset && (
                      <TextLink onPress={handleResetAll} color="rgba(255,255,255,0.85)">
                        {t('chores.reset_all')}
                      </TextLink>
                    )}
                  </View>
                )}

                <Text style={[type.bodySm, { color: 'rgba(255,255,255,0.78)' }]}>
                  {"Assign tasks, claim what you'll do, and check them off together."}
                </Text>
              </View>

              {/* ── Add form ───────────────────────────────────────── */}
              <View style={[styles.formCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('chores.add_chore')}</Text>

                <TextInput
                  value={choreName}
                  onChangeText={setChoreName}
                  placeholder={t('chores.chore_placeholder')}
                  placeholderTextColor={C.textSecondary}
                  style={[styles.formInput, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                  returnKeyType="done"
                  onSubmitEditing={handleAdd}
                  accessibilityLabel="Chore name"
                />

                {/* Recurrence */}
                <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('chores.repeat')}</Text>
                <View style={styles.chipRow}>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <Chip
                      key={opt.value}
                      label={opt.label}
                      selected={recurrence === opt.value}
                      onPress={() => handleRecurrenceChange(opt.value)}
                      C={C}
                    />
                  ))}
                </View>

                {recurrence === 'weekly' && (
                  <View style={{ gap: 8 }}>
                    <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('chores.which_day')}</Text>
                    <View style={styles.weekDayRow}>
                      {WEEK_DAYS.map((day, i) => (
                        <DayChip
                          key={day}
                          label={weekDayLabels[i].slice(0, 2)}
                          selected={recurrenceDay === day}
                          onPress={() => setRecurrenceDay(day)}
                          C={C}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {recurrence === 'monthly' && (
                  <View style={{ gap: 8 }}>
                    <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('chores.which_day_of_month')}</Text>
                    <View style={styles.monthDayGrid}>
                      {MONTH_DAYS.map((d) => (
                        <DayChip
                          key={d}
                          label={d}
                          selected={recurrenceDay === d}
                          onPress={() => setRecurrenceDay(d)}
                          C={C}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {!!addError && (
                  <View style={[styles.errorBox, { backgroundColor: C.danger + '15' }]}>
                    <Ionicons name="warning-outline" size={14} color={C.danger} />
                    <Text style={[type.bodySm, { color: C.danger, flex: 1 }]}>{addError}</Text>
                  </View>
                )}

                <Button
                  variant="primary"
                  onPress={handleAdd}
                  loading={isAdding}
                  disabled={isAdding || !choreName.trim()}
                  fullWidth
                  icon="add"
                  haptic={null}
                >
                  {isAdding ? t('chores.adding') : t('chores.add_chore')}
                </Button>
              </View>

              {isLoading && chores.length === 0 && (
                <ActivityIndicator size="small" color={C.primary} style={{ marginVertical: 12 }} />
              )}
              {!!storeError && (
                <View style={[styles.storeErrorBox, { backgroundColor: C.danger + '12', borderColor: C.danger + '35' }]}>
                  <Text style={[type.bodySm, { color: C.danger }]}>{storeError}</Text>
                </View>
              )}

              {pending.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('chores.todo')}</Text>
                  <View style={[styles.countPill, { backgroundColor: C.secondary }]}>
                    <Text style={[type.captionMed, { color: C.secondaryForeground, fontWeight: '700' }]}>{pending.length}</Text>
                  </View>
                </View>
              )}
            </View>
          }

          ListFooterComponent={
            done.length > 0 ? (
              <View style={[styles.sectionHeader, { marginTop: 16 }]}>
                <Text style={[type.eyebrow, { color: C.textSecondary }]}>{t('chores.done_section')}</Text>
                <View style={[styles.countPill, { backgroundColor: C.positive + '20' }]}>
                  <Text style={[type.captionMed, { color: C.positive, fontWeight: '700' }]}>{done.length}</Text>
                </View>
              </View>
            ) : null
          }

          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-outline"
              title={t('chores.no_chores')}
              message={t('chores.no_chores_hint')}
            />
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Chips ────────────────────────────────────────────────────────────────────
function Chip({ label, selected, onPress, C }: { label: string; selected: boolean; onPress: () => void; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.94);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          paddingHorizontal: 14, paddingVertical: 9,
          borderRadius: 9999, borderWidth: 1.5,
          borderColor: selected ? C.primary : C.border,
          backgroundColor: selected ? C.primary : C.surfaceSecondary,
          minHeight: 36,
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Text style={[type.labelSm, { color: selected ? '#fff' : C.textPrimary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function DayChip({ label, selected, onPress, C }: { label: string; selected: boolean; onPress: () => void; C: ColorTokens }): React.JSX.Element {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          width: 44, height: 44, borderRadius: 22,
          borderWidth: 1.5,
          borderColor: selected ? C.primary : C.border,
          backgroundColor: selected ? C.primary : C.surfaceSecondary,
          justifyContent: 'center', alignItems: 'center',
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Text style={[type.captionMed, { color: selected ? '#fff' : C.textPrimary, fontWeight: '700' }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  const isDark = C.background !== '#F6F2EA';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    list: { paddingHorizontal: sizes.md, paddingTop: 4, paddingBottom: 60 },
    sep:  { height: 8 },

    // Blue hero
    heroCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      padding: sizes.lg, gap: 14, marginBottom: sizes.md,
      position: 'relative', overflow: 'hidden',
    },
    heroDeco: {
      position: 'absolute', top: -40, right: -30, width: 160, height: 160,
      borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.07)',
    },
    heroDecoSm: {
      position: 'absolute', bottom: -50, left: -20, width: 110, height: 110,
      borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    heroIcon: {
      width: 48, height: 48, borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.16)',
      justifyContent: 'center', alignItems: 'center',
    },
    heroProgress: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    heroProgressTrack: {
      flex: 1, height: 8, borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden',
    },
    heroProgressFill: { height: 8, backgroundColor: '#fff', borderRadius: 4 },

    // Form card
    formCard: {
      borderRadius: sizes.borderRadiusLg, borderWidth: 1,
      padding: sizes.lg, gap: sizes.sm, marginBottom: sizes.lg,
      ...(isDark
        ? {}
        : {
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
          }),
    } as never,
    formInput: {
      height: 46, borderRadius: 10, borderWidth: 1,
      paddingHorizontal: 13, fontSize: 15,
    },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    weekDayRow:  { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    monthDayGrid:{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: 10, padding: 10,
    },
    storeErrorBox: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },

    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 4, marginBottom: 10,
    },
    countPill: {
      minHeight: 22, paddingHorizontal: 8, borderRadius: 9999,
      justifyContent: 'center', alignItems: 'center',
    },

    // Chore row
    choreRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 12,
      borderRadius: 14, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border,
      ...(isDark
        ? {}
        : {
            shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
          }),
    } as never,
    choreRowDone: { backgroundColor: C.surfaceSecondary, borderColor: 'transparent' },
    checkBtn:     { flexShrink: 0, padding: 2 },
    choreInfo:    { flex: 1, gap: 4 },
    freqRow:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
    claimedRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    claimedBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 9999,
    },
    deleteBtn: { padding: 4, flexShrink: 0 },
  });
}
