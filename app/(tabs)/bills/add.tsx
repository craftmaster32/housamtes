// app/(tabs)/bills/add.tsx
// Add expense — v2 redesign.
// Same data flow as v1 (useBillsStore, useHousematesStore, useAuthStore,
// useSettingsStore, useBadgeStore). New: dark theme via useThemedColors,
// `type` ladder, `Header` UI primitive, animated press scale on every chip,
// fade-up entrance, count-up "per person" preview, success haptic on save.

import { useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useBillsStore, CATEGORIES } from '@stores/billsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useBadgeStore } from '@stores/badgeStore';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Button, EmptyState, Header } from '@components/ui';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useFadeInUp, usePressScale, useCountUp, useHaptic } from '@utils/animations';

type SplitType = 'equal' | 'custom';

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  rent: 'home-outline',
  groceries: 'cart-outline',
  food: 'fast-food-outline',
  transport: 'car-outline',
  utilities: 'flash-outline',
  internet: 'wifi-outline',
  phone: 'phone-portrait-outline',
  entertainment: 'musical-notes-outline',
  health: 'medkit-outline',
  shopping: 'bag-outline',
  travel: 'airplane-outline',
  other: 'receipt-outline',
};

function todayString(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDisplayDate(iso: string, locale: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return d.toLocaleDateString(locale || undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AddBillScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const haptic = useHaptic();
  const housemates = useHousematesStore((state) => state.housemates);
  const housematesLoading = useHousematesStore((state) => state.isLoading);
  const addBill = useBillsStore((state) => state.addBill);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const markSeen = useBadgeStore((s) => s.markSeen);

  const myId = profile?.id ?? '';
  const allIds = useMemo(() => housemates.map((h) => h.id), [housemates]);

  // Refs keep latest values accessible inside the stable useFocusEffect
  // callback without making allIds/myId part of its dependency array — which
  // would re-fire the effect and wipe the draft on every housemate reload.
  const allIdsRef = useRef(allIds);
  allIdsRef.current = allIds;
  const myIdRef = useRef(myId);
  myIdRef.current = myId;

  const [title, setTitle]                 = useState('');
  const [amount, setAmount]               = useState('');
  const [paidBy, setPaidBy]               = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [category, setCategory]           = useState(CATEGORIES[0]);
  const [date, setDate]                   = useState(todayString);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const closeDatePicker = useCallback(() => setShowDatePicker(false), []);
  const [splitType, setSplitType]         = useState<SplitType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading]         = useState(false);
  const [error, setError]                 = useState('');

  // Entry fade-up for the form.
  const fadeStyle = useFadeInUp(0);

  const resetForm = useCallback((ids: string[], userId: string) => {
    setTitle('');
    setAmount('');
    setPaidBy(userId || ids[0] || '');
    setSelectedPeople(ids.length > 0 ? ids : []);
    setCategory(CATEGORIES[0]);
    setDate(todayString());
    setSplitType('equal');
    setCustomAmounts({});
    setIsLoading(false);
    setError('');
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm(allIdsRef.current, myIdRef.current);
    }, [resetForm])
  );

  const togglePerson = useCallback((id: string) => {
    setSelectedPeople((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }, []);

  const setPersonAmount = useCallback((id: string, value: string) => {
    setCustomAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);

  const totalAmount = parseFloat(amount) || 0;
  const perPerson   = selectedPeople.length > 0 ? totalAmount / selectedPeople.length : 0;

  // Animated "per person" amount preview.
  const displayPerPerson = useCountUp(perPerson, {
    formatter: (n) => formatFull(n, currencyCode),
    duration: 350,
  });

  const getCustomTotal = useCallback((): number => {
    return selectedPeople.reduce(
      (sum, id) => sum + (parseFloat(customAmounts[id] ?? '0') || 0),
      0
    );
  }, [selectedPeople, customAmounts]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) { setError(t('bills.enter_title')); return; }
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setError(t('bills.enter_valid_amount')); return; }
    if (!paidBy) { setError(t('bills.select_who_paid')); return; }
    if (selectedPeople.length === 0) { setError(t('bills.select_split')); return; }

    let splitAmounts: Record<string, number> | null = null;
    if (splitType === 'custom') {
      const customTotal = getCustomTotal();
      if (Math.abs(customTotal - parsed) > 0.01) {
        setError(t('bills.custom_total_mismatch', { entered: customTotal.toFixed(2), total: parsed.toFixed(2) }));
        return;
      }
      splitAmounts = {};
      for (const id of selectedPeople) {
        splitAmounts[id] = parseFloat(customAmounts[id] ?? '0') || 0;
      }
    }

    try {
      setIsLoading(true);
      await addBill({
        title: title.trim(),
        amount: parsed,
        paidBy,
        splitBetween: selectedPeople,
        splitAmounts,
        category,
        date,
      }, houseId ?? '');
      markSeen('bills').catch(() => {});
      haptic.success();
      // Reset before navigating so stale state never persists on re-entry
      resetForm(allIds, myId);
      router.replace('/(tabs)/bills');
    } catch {
      setError(t('bills.failed_save'));
    } finally {
      setIsLoading(false);
    }
  }, [title, amount, paidBy, selectedPeople, splitType, customAmounts, category, date, addBill, houseId, getCustomTotal, markSeen, haptic, resetForm, allIds, myId, t]);

  if (housematesLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title={t('bills.add_title')} back />
        <View style={styles.centered}>
          <EmptyState mode="loading" title="Loading…" />
        </View>
      </SafeAreaView>
    );
  }

  const canSave = !isLoading && title.trim() && amount && paidBy && selectedPeople.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={t('bills.add_title')} back />
      <Animated.View style={[styles.flex, fadeStyle]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── Title ────────────────────────────────────────────── */}
          <Field label={t('bills.what_for')} C={C}>
            <TextInput
              value={title}
              onChangeText={(v) => { setTitle(v); setError(''); }}
              mode="outlined"
              style={styles.input}
              placeholder={t('bills.what_for_placeholder')}
              outlineColor={C.border}
              activeOutlineColor={C.primary}
              accessibilityLabel={t('bills.what_for')}
              accessibilityHint={t('bills.what_for_hint')}
            />
          </Field>

          {/* ── Amount ───────────────────────────────────────────── */}
          <Field label={t('bills.amount')} C={C}>
            <TextInput
              value={amount}
              onChangeText={(v) => { setAmount(v); setError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="0.00"
              outlineColor={C.border}
              activeOutlineColor={C.primary}
              accessibilityLabel={t('bills.amount')}
              accessibilityHint={t('bills.amount_hint')}
            />
          </Field>

          {/* ── Who paid ─────────────────────────────────────────── */}
          <Field label={t('bills.who_paid')} C={C}>
            <View style={styles.chipRow}>
              {housemates.map((h) => (
                <PersonChip
                  key={h.id}
                  selected={paidBy === h.id}
                  onPress={() => setPaidBy(h.id)}
                  label={`${h.name}${h.id === myId ? ` (${t('common.me')})` : ''}`}
                  role="radio"
                  C={C}
                />
              ))}
            </View>
          </Field>

          {/* ── Split between ────────────────────────────────────── */}
          <Field
            label={t('bills.split_between')}
            right={
              <Pressable onPress={() => setSelectedPeople(allIds)} accessibilityRole="button">
                <Text style={[type.labelSm, { color: C.primary }]}>{t('bills.select_all')}</Text>
              </Pressable>
            }
            C={C}
          >
            <View style={styles.chipRow}>
              {housemates.map((h) => (
                <PersonChip
                  key={h.id}
                  selected={selectedPeople.includes(h.id)}
                  onPress={() => togglePerson(h.id)}
                  label={`${h.name}${h.id === myId ? ` (${t('common.me')})` : ''}`}
                  role="checkbox"
                  C={C}
                />
              ))}
            </View>
            {selectedPeople.length > 0 && (
              <Text style={[type.caption, { color: C.textSecondary, marginTop: 4 }]}>
                {t('bills.selected_one', { count: selectedPeople.length })}
              </Text>
            )}
          </Field>

          {/* ── How to split ─────────────────────────────────────── */}
          {selectedPeople.length > 0 && (
            <Field label={t('bills.how_to_split')} C={C}>
              <View style={styles.chipRow}>
                <SplitTypeChip
                  selected={splitType === 'equal'}
                  onPress={() => setSplitType('equal')}
                  label={t('bills.equal')}
                  C={C}
                />
                <SplitTypeChip
                  selected={splitType === 'custom'}
                  onPress={() => setSplitType('custom')}
                  label={t('bills.custom_amounts')}
                  C={C}
                />
              </View>

              {splitType === 'equal' && totalAmount > 0 && (
                <View style={styles.previewBox}>
                  <Ionicons name="people-outline" size={16} color={C.primary} />
                  <Text style={[type.labelSm, { color: C.primary }]}>
                    {displayPerPerson} {t('bills.per_person')}
                  </Text>
                </View>
              )}

              {splitType === 'custom' && (
                <View style={[styles.customBox, { backgroundColor: C.surface, borderColor: C.border }]}>
                  {selectedPeople.map((id) => (
                    <View key={id} style={styles.customRow}>
                      <Text style={[type.bodyMdMed, { color: C.textPrimary, flex: 1 }]}>
                        {housemates.find((h) => h.id === id)?.name ?? id}
                      </Text>
                      <TextInput
                        value={customAmounts[id] ?? ''}
                        onChangeText={(v) => setPersonAmount(id, v)}
                        mode="outlined"
                        style={styles.customInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        dense
                        outlineColor={C.border}
                        accessibilityLabel={t('bills.custom_amount_for', { name: housemates.find((h) => h.id === id)?.name ?? id })}
                        accessibilityHint={t('bills.custom_amount_hint')}
                        activeOutlineColor={C.primary}
                      />
                    </View>
                  ))}
                  <View style={[styles.customTotal, { borderTopColor: C.border }]}>
                    <Text style={[type.bodyMdMed, { color: C.textSecondary }]}>{t('bills.total_entered')}</Text>
                    <Text style={[type.amount, {
                      color: Math.abs(getCustomTotal() - totalAmount) < 0.01 ? C.positive : C.danger,
                    }]}>
                      {formatFull(getCustomTotal(), currencyCode)} / {formatFull(totalAmount, currencyCode)}
                    </Text>
                  </View>
                </View>
              )}
            </Field>
          )}

          {/* ── Category ─────────────────────────────────────────── */}
          <Field label={t('bills.category')} C={C}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {CATEGORIES.map((cat) => {
                const icon = CATEGORY_ICONS[cat.toLowerCase()] ?? 'receipt-outline';
                const selected = category === cat;
                return (
                  <CategoryChip
                    key={cat}
                    icon={icon}
                    selected={selected}
                    onPress={() => setCategory(cat)}
                    label={t(`bills.cat_${cat.toLowerCase()}`)}
                    C={C}
                  />
                );
              })}
            </ScrollView>
          </Field>

          {/* ── Date ─────────────────────────────────────────────── */}
          <Field label={t('bills.date')} C={C}>
            <DateTrigger
              date={date}
              onPress={() => setShowDatePicker(true)}
              expanded={showDatePicker}
              locale={i18n.language}
              C={C}
            />
          </Field>

          {!!error && (
            <View style={[styles.errorBox, { backgroundColor: C.danger + '14' }]}>
              <Ionicons name="warning-outline" size={16} color={C.danger} />
              <Text style={[type.bodySm, { color: C.danger, flex: 1 }]}>{error}</Text>
            </View>
          )}

          <Button
            variant="primary"
            onPress={handleSave}
            loading={isLoading}
            disabled={!canSave}
            fullWidth
            size="lg"
            style={styles.saveBtn}
            haptic={null /* save handler fires success haptic explicitly */}
          >
            {t('bills.save_expense')}
          </Button>
        </ScrollView>
      </Animated.View>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={setDate}
        onClose={closeDatePicker}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Field({ label, right, children, C }: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  C: ColorTokens;
}): React.JSX.Element {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[type.eyebrow, { color: C.textSecondary }]}>{label}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function PersonChip({
  selected, onPress, label, role, C,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  role: 'radio' | 'checkbox';
  C: ColorTokens;
}): React.JSX.Element {
  const press = usePressScale(0.95);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        style={[
          {
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 9999,
            borderWidth: 1.5,
            borderColor: selected ? C.primary : C.border,
            backgroundColor: selected ? C.primary : C.surface,
          },
        ]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole={role}
        accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      >
        <Text style={[type.labelSm, { color: selected ? '#fff' : C.textPrimary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SplitTypeChip({
  selected, onPress, label, C,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  C: ColorTokens;
}): React.JSX.Element {
  const press = usePressScale(0.95);
  return (
    <Animated.View style={[{ flex: 1 }, press.animatedStyle]}>
      <Pressable
        style={[
          {
            paddingVertical: 11, paddingHorizontal: 14, minHeight: 44,
            borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: selected ? C.primary : C.border,
            backgroundColor: selected ? C.primary : C.surface,
          },
        ]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
      >
        <Text style={[type.labelSm, { color: selected ? '#fff' : C.textPrimary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function CategoryChip({
  icon, selected, onPress, label, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
  label: string;
  C: ColorTokens;
}): React.JSX.Element {
  const press = usePressScale(0.93);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        style={[
          {
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 10, paddingHorizontal: 12, minHeight: 44,
            borderRadius: 9999, borderWidth: 1.5,
            borderColor: selected ? C.primary : C.primary + '55',
            backgroundColor: selected ? C.primary : C.primary + '08',
          },
        ]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Ionicons name={icon} size={15} color={selected ? '#fff' : C.primary} />
        <Text style={[type.labelSm, { color: selected ? '#fff' : C.primary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function DateTrigger({
  date, onPress, expanded, locale, C,
}: {
  date: string;
  onPress: () => void;
  expanded: boolean;
  locale: string;
  C: ColorTokens;
}): React.JSX.Element {
  const press = usePressScale(0.98);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        style={[
          {
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
            borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, minHeight: 44,
          },
        ]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons name="calendar-outline" size={18} color={C.primary} />
        <Text style={[type.bodyMd, { color: C.textPrimary, flex: 1 }]}>{formatDisplayDate(date, locale)}</Text>
        <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    flex:      { flex: 1 },
    centered:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content:   { padding: sizes.lg, gap: sizes.lg, paddingBottom: 60 },

    input: { backgroundColor: C.surface },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    previewBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.primary + '14',
      borderRadius: 10, padding: sizes.sm, marginTop: 4,
    },

    customBox: {
      borderRadius: 12, padding: sizes.md, gap: sizes.sm,
      borderWidth: 1, marginTop: 4,
    },
    customRow:   { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    customInput: { width: 110, backgroundColor: C.surface },
    customTotal: {
      flexDirection: 'row', justifyContent: 'space-between',
      paddingTop: sizes.xs, borderTopWidth: 1,
    },

    categoryScroll: { gap: sizes.xs, paddingVertical: 2 },

    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 10, padding: sizes.md,
    },

    saveBtn: { marginTop: sizes.sm },
  });
}
