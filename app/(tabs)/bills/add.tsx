import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBillsStore, CATEGORIES } from '@stores/billsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

type SplitType = 'equal' | 'custom';

export default function AddBillScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const housemates = useHousematesStore((state) => state.housemates);
  const housematesLoading = useHousematesStore((state) => state.isLoading);
  const addBill = useBillsStore((state) => state.addBill);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const currency = useSettingsStore((s) => s.currency);

  const allNames = useMemo(() => housemates.map((h) => h.name), [housemates]);
  const myName = profile?.name ?? '';

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(myName || allNames[0] || '');
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Once housemates load, set sensible defaults
  useEffect(() => {
    if (allNames.length === 0) return;
    setPaidBy((prev) => prev || myName || allNames[0]);
    setSelectedPeople((prev) => (prev.length === 0 ? allNames : prev));
  }, [allNames, myName]);

  const togglePerson = useCallback((name: string) => {
    setSelectedPeople((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  const setPersonAmount = useCallback((name: string, value: string) => {
    setCustomAmounts((prev) => ({ ...prev, [name]: value }));
    setError('');
  }, []);

  const totalAmount = parseFloat(amount) || 0;

  const getCustomTotal = useCallback((): number => {
    return selectedPeople.reduce(
      (sum, name) => sum + (parseFloat(customAmounts[name] ?? '0') || 0),
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
      for (const name of selectedPeople) {
        splitAmounts[name] = parseFloat(customAmounts[name] ?? '0') || 0;
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
      router.replace('/(tabs)/bills');
    } catch {
      setError(t('bills.failed_save'));
      setIsLoading(false);
    }
  }, [title, amount, paidBy, selectedPeople, splitType, customAmounts, category, date, addBill, houseId, getCustomTotal, t]);

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
            {allNames.map((name) => (
              <Pressable
                key={name}
                style={[styles.chip, paidBy === name && styles.chipSelected]}
                onPress={() => setPaidBy(name)}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ selected: paidBy === name }}
              >
                <Text style={[styles.chipText, paidBy === name && styles.chipTextSelected]}>
                  {name}{name === myName ? ` (${t('common.me')})` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Split between */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('bills.split_between')}</Text>
            <Pressable onPress={() => setSelectedPeople(allNames)}>
              <Text style={styles.selectAll}>{t('bills.select_all')}</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {allNames.map((name) => (
              <Pressable
                key={name}
                style={[styles.chip, selectedPeople.includes(name) && styles.chipSelected]}
                onPress={() => togglePerson(name)}
                accessible
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selectedPeople.includes(name) }}
              >
                <Text style={[styles.chipText, selectedPeople.includes(name) && styles.chipTextSelected]}>
                  {name}{name === myName ? ` (${t('common.me')})` : ''}
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

            {/* Equal preview */}
            {splitType === 'equal' && totalAmount > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  {currency}{(totalAmount / selectedPeople.length).toFixed(2)} {t('bills.per_person')}
                </Text>
              </View>
            )}

            {/* Custom split inputs */}
            {splitType === 'custom' && (
              <View style={styles.customBox}>
                {selectedPeople.map((name) => (
                  <View key={name} style={styles.customRow}>
                    <Text style={styles.customName}>{name}</Text>
                    <TextInput
                      value={customAmounts[name] ?? ''}
                      onChangeText={(v) => setPersonAmount(name, v)}
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
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={[styles.chip, category === cat && styles.chipSelected]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>{t(`bills.cat_${cat.toLowerCase()}`)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Date */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.date')}</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            mode="outlined"
            style={styles.input}
            placeholder="YYYY-MM-DD"
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
          />
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
