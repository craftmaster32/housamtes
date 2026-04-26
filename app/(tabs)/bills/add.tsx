import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
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
import { colors } from '@constants/colors';
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

function formatDisplayDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AddBillScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((state) => state.housemates);
  const housematesLoading = useHousematesStore((state) => state.isLoading);
  const addBill = useBillsStore((state) => state.addBill);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const currency = useSettingsStore((s) => s.currency);
  const markSeen = useBadgeStore((s) => s.markSeen);

  const myId = profile?.id ?? '';
  const allIds = useMemo(() => housemates.map((h) => h.id), [housemates]);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(todayString);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      resetForm(allIds, myId);
    }, [allIds, myId, resetForm])
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
          <ActivityIndicator color={colors.primary} />
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
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
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
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
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
                  {currency}{(totalAmount / selectedPeople.length).toFixed(2)} {t('bills.per_person')}
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
                      outlineColor={colors.border}
                      activeOutlineColor={colors.primary}
                    />
                  </View>
                ))}
                <View style={styles.customTotal}>
                  <Text style={styles.customTotalLabel}>{t('bills.total_entered')}</Text>
                  <Text style={[
                    styles.customTotalValue,
                    { color: Math.abs(getCustomTotal() - totalAmount) < 0.01 ? colors.positive : colors.danger },
                  ]}>
                    {currency}{getCustomTotal().toFixed(2)} / {currency}{totalAmount.toFixed(2)}
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
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Ionicons name={icon} size={15} color={selected ? colors.white : colors.primary} />
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
            accessibilityRole="button"
            accessibilityLabel="Pick date"
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.dateTriggerText}>{formatDisplayDate(date)}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={isLoading}
          disabled={isLoading || !title || !amount || !paidBy || selectedPeople.length === 0}
          style={styles.saveBtn}
          contentStyle={styles.saveBtnContent}
          labelStyle={styles.saveBtnLabel}
          buttonColor={colors.primary}
        >
          {t('bills.save_expense')}
        </Button>
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={setDate}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: sizes.lg, gap: sizes.md, paddingBottom: 60 },

  header: { gap: 4, marginBottom: sizes.xs },
  backBtn: { alignSelf: 'flex-start' },
  backText: { color: colors.primary, fontSize: 15, ...font.semibold },
  heading: { fontSize: 24, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.5 },

  field: { gap: sizes.xs },
  label: { color: colors.textPrimary, ...font.semibold, fontSize: 14 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectAll: { color: colors.primary, fontSize: 13, ...font.semibold },
  input: { backgroundColor: colors.white },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: sizes.sm,
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textPrimary, fontSize: 14, ...font.medium },
  chipTextSelected: { color: colors.white },
  splitCount: { color: colors.textSecondary, fontSize: 12, ...font.regular, marginTop: 2 },

  previewBox: {
    backgroundColor: colors.primary + '12',
    borderRadius: 10,
    padding: sizes.sm,
    alignItems: 'center',
    marginTop: sizes.xs,
  },
  previewText: { color: colors.primary, ...font.semibold, fontSize: 15 },

  customBox: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: sizes.md,
    gap: sizes.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: sizes.xs,
  },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
  customName: { flex: 1, color: colors.textPrimary, fontSize: 15, ...font.medium },
  customInput: { width: 110, backgroundColor: colors.white },
  customTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: sizes.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  customTotalLabel: { color: colors.textSecondary, fontSize: 14, ...font.medium },
  customTotalValue: { fontSize: 14, ...font.semibold },

  // Category horizontal scroll
  categoryScroll: { gap: sizes.xs, paddingVertical: 2 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: sizes.borderRadiusFull,
    borderWidth: 1.5,
    borderColor: colors.primary + '55',
    backgroundColor: colors.primary + '08',
  },
  catChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { color: colors.primary, fontSize: 13, ...font.semibold },
  catChipTextSelected: { color: colors.white },

  // Date trigger button
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateTriggerText: { flex: 1, fontSize: 15, ...font.medium, color: colors.textPrimary },

  errorBox: {
    backgroundColor: colors.danger + '12',
    borderRadius: 10,
    padding: sizes.md,
  },
  errorText: { color: colors.danger, fontSize: 14, ...font.regular },

  saveBtn: { borderRadius: 14, marginTop: sizes.sm },
  saveBtnContent: { height: 52 },
  saveBtnLabel: { fontSize: 16, ...font.semibold },
});
