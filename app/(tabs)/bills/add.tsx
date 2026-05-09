import { useState, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useBillsStore, CATEGORIES } from '@stores/billsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useBadgeStore } from '@stores/badgeStore';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Button, EmptyState } from '@components/ui';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

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
  const housemates = useHousematesStore((state) => state.housemates);
  const housematesLoading = useHousematesStore((state) => state.isLoading);
  const addBill = useBillsStore((state) => state.addBill);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const markSeen = useBadgeStore((s) => s.markSeen);

  const myId = profile?.id ?? '';
  const allIds = useMemo(() => housemates.map((h) => h.id), [housemates]);

  // Refs keep the latest values accessible inside the stable useFocusEffect
  // callback without making allIds/myId part of its dependency array — which
  // would re-fire the effect (and wipe a draft) whenever housemates reload.
  const allIdsRef = useRef(allIds);
  allIdsRef.current = allIds;
  const myIdRef = useRef(myId);
  myIdRef.current = myId;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(todayString);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const closeDatePicker = useCallback(() => setShowDatePicker(false), []);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      // Reset before navigating so stale state never persists on re-entry
      resetForm(allIds, myId);
      router.replace('/(tabs)/bills');
    } catch {
      setError(t('bills.failed_save'));
      setIsLoading(false);
    }
  }, [title, amount, paidBy, selectedPeople, splitType, customAmounts, category, date, addBill, houseId, getCustomTotal, markSeen, resetForm, allIds, myId, t]);

  if (housematesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <EmptyState mode="loading" title="Loading…" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← {t('common.back')}</Text>
          </Pressable>
          <Text style={styles.heading}>{t('bills.add_title')}</Text>
        </View>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.what_for')}</Text>
          <TextInput
            value={title}
            onChangeText={(v) => { setTitle(v); setError(''); }}
            mode="outlined"
            style={styles.input}
            placeholder={t('bills.what_for_placeholder')}
            outlineColor={C.border}
            activeOutlineColor={C.primary}
            accessibilityLabel={t('bills.what_for')}
            accessibilityHint={t('bills.what_for_placeholder')}
          />
        </View>

        {/* Amount */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.amount')}</Text>
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
            accessibilityHint={t('bills.enter_valid_amount')}
          />
        </View>

        {/* Who paid */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.who_paid')}</Text>
          <View style={styles.chipRow}>
            {housemates.map((h) => (
              <Pressable
                key={h.id}
                style={[styles.chip, paidBy === h.id && styles.chipSelected]}
                onPress={() => setPaidBy(h.id)}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ selected: paidBy === h.id }}
              >
                <Text style={[styles.chipText, paidBy === h.id && styles.chipTextSelected]}>
                  {h.name}{h.id === myId ? ` (${t('common.me')})` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Split between */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('bills.split_between')}</Text>
            <Pressable onPress={() => setSelectedPeople(allIds)}>
              <Text style={styles.selectAll}>{t('bills.select_all')}</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {housemates.map((h) => (
              <Pressable
                key={h.id}
                style={[styles.chip, selectedPeople.includes(h.id) && styles.chipSelected]}
                onPress={() => togglePerson(h.id)}
                accessible
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedPeople.includes(h.id) }}
              >
                <Text style={[styles.chipText, selectedPeople.includes(h.id) && styles.chipTextSelected]}>
                  {h.name}{h.id === myId ? ` (${t('common.me')})` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
          {selectedPeople.length > 0 && (
            <Text style={styles.splitCount}>
              {t('bills.selected_one', { count: selectedPeople.length })}
            </Text>
          )}
        </View>

        {/* How to split */}
        {selectedPeople.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>{t('bills.how_to_split')}</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, splitType === 'equal' && styles.chipSelected]}
                onPress={() => setSplitType('equal')}
              >
                <Text style={[styles.chipText, splitType === 'equal' && styles.chipTextSelected]}>
                  {t('bills.equal')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, splitType === 'custom' && styles.chipSelected]}
                onPress={() => setSplitType('custom')}
              >
                <Text style={[styles.chipText, splitType === 'custom' && styles.chipTextSelected]}>
                  {t('bills.custom_amounts')}
                </Text>
              </Pressable>
            </View>

            {splitType === 'equal' && totalAmount > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  {formatFull(totalAmount / selectedPeople.length, currencyCode)} {t('bills.per_person')}
                </Text>
              </View>
            )}

            {splitType === 'custom' && (
              <View style={styles.customBox}>
                {selectedPeople.map((id) => (
                  <View key={id} style={styles.customRow}>
                    <Text style={styles.customName}>{housemates.find((h) => h.id === id)?.name ?? id}</Text>
                    <TextInput
                      value={customAmounts[id] ?? ''}
                      onChangeText={(v) => setPersonAmount(id, v)}
                      mode="outlined"
                      style={styles.customInput}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      dense
                      outlineColor={C.border}
                      activeOutlineColor={C.primary}
                    />
                  </View>
                ))}
                <View style={styles.customTotal}>
                  <Text style={styles.customTotalLabel}>{t('bills.total_entered')}</Text>
                  <Text style={[
                    styles.customTotalValue,
                    { color: Math.abs(getCustomTotal() - totalAmount) < 0.01 ? C.positive : C.danger },
                  ]}>
                    {formatFull(getCustomTotal(), currencyCode)} / {formatFull(totalAmount, currencyCode)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.category')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const icon = CATEGORY_ICONS[cat.toLowerCase()] ?? 'receipt-outline';
              const selected = category === cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.catChip, selected && styles.catChipSelected]}
                  onPress={() => setCategory(cat)}
                  accessible
                  accessibilityRole="radio"
                  accessibilityLabel={t(`bills.cat_${cat.toLowerCase()}`)}
                  accessibilityState={{ selected }}
                >
                  <Ionicons name={icon} size={15} color={selected ? C.white : C.primary} />
                  <Text style={[styles.catChipText, selected && styles.catChipTextSelected]}>
                    {t(`bills.cat_${cat.toLowerCase()}`)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.date')}</Text>
          <Pressable
            style={styles.dateTrigger}
            onPress={() => setShowDatePicker(true)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('bills.pick_date')}
            accessibilityState={{ expanded: showDatePicker }}
          >
            <Ionicons name="calendar-outline" size={18} color={C.primary} />
            <Text style={styles.dateTriggerText}>{formatDisplayDate(date, i18n.language)}</Text>
            <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
          </Pressable>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          variant="primary"
          onPress={handleSave}
          loading={isLoading}
          disabled={isLoading || !title || !amount || !paidBy || selectedPeople.length === 0}
          fullWidth
          size="lg"
          style={styles.saveBtn}
        >
          {t('bills.save_expense')}
        </Button>
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={setDate}
        onClose={closeDatePicker}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C: ColorTokens) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: sizes.lg, gap: sizes.md, paddingBottom: 60 },

  header: { gap: 4, marginBottom: sizes.xs },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: C.primary, fontSize: 15, ...font.semibold },
  heading: { fontSize: 24, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.5 },

  field: { gap: sizes.xs },
  label: { color: C.textPrimary, ...font.semibold, fontSize: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectAll: { color: C.primary, fontSize: 13, ...font.semibold },
  input: { backgroundColor: C.surface },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: sizes.sm,
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  chipSelected: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.textPrimary, fontSize: 14, ...font.medium },
  chipTextSelected: { color: C.white },
  splitCount: { color: C.textSecondary, fontSize: 12, ...font.regular, marginTop: 2 },

  previewBox: {
    backgroundColor: C.primary + '12',
    borderRadius: 10,
    padding: sizes.sm,
    alignItems: 'center',
    marginTop: sizes.xs,
  },
  previewText: { color: C.primary, ...font.semibold, fontSize: 15 },

  customBox: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: sizes.md,
    gap: sizes.sm,
    borderWidth: 1,
    borderColor: C.border,
    marginTop: sizes.xs,
  },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
  customName: { flex: 1, color: C.textPrimary, fontSize: 15, ...font.medium },
  customInput: { width: 110, backgroundColor: C.surface },
  customTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: sizes.xs,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  customTotalLabel: { color: C.textSecondary, fontSize: 14, ...font.medium },
  customTotalValue: { fontSize: 14, ...font.semibold },

  categoryScroll: { gap: sizes.xs, paddingVertical: 2 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1.5,
    borderColor: C.primary + '55',
    backgroundColor: C.primary + '08',
  },
  catChipSelected: { backgroundColor: C.primary, borderColor: C.primary },
  catChipText: { color: C.primary, fontSize: 13, ...font.semibold },
  catChipTextSelected: { color: C.white },

  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 44,
  },
  dateTriggerText: { flex: 1, fontSize: 15, ...font.medium, color: C.textPrimary },

  errorBox: {
    backgroundColor: C.danger + '12',
    borderRadius: 10,
    padding: sizes.md,
  },
  errorText: { color: C.danger, fontSize: 14, ...font.regular },

  saveBtn: { marginTop: sizes.sm },
});
