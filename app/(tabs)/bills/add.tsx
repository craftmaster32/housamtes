import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useBillsStore, CATEGORIES } from '@stores/billsStore';
import { captureError } from '@lib/errorTracking';
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
import { parseAndValidateAddBill, parseAmount, type AddBillPayload } from '@utils/validation';

type SplitType = 'equal' | 'custom' | 'percentage';

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

const CATEGORY_GROUPS: { label: string; items: string[] }[] = [
  { label: 'Rent', items: ['Rent'] },
  { label: 'Utilities', items: ['Utilities', 'Internet', 'Phone'] },
  { label: 'Food & Shopping', items: ['Groceries', 'Food', 'Shopping'] },
  { label: 'Other', items: ['Transport', 'Entertainment', 'Health', 'Travel', 'Other'] },
];

function todayString(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDisplayDate(iso: string, locale: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return d.toLocaleDateString(locale || undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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

  // If housemates finish loading after this screen is already focused,
  // useFocusEffect won't re-fire — so seed defaults here once they arrive.
  useEffect(() => {
    if (allIds.length > 0 && selectedPeople.length === 0 && !title && !amount) {
      setSelectedPeople(allIds);
      if (!paidBy) setPaidBy(myIdRef.current || allIds[0] || '');
    }
    // Only run when allIds changes; the other values are just guards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIds]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(todayString);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const closeDatePicker = useCallback(() => setShowDatePicker(false), []);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentAmounts, setPercentAmounts] = useState<Record<string, string>>({});
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
    setPercentAmounts({});
    setIsLoading(false);
    setError('');
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm(allIdsRef.current, myIdRef.current);
    }, [resetForm])
  );

  const togglePerson = useCallback((id: string) => {
    setSelectedPeople((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
    setError('');
  }, []);

  const totalAmount = parseAmount(amount);

  const setPersonAmount = useCallback((id: string, value: string): void => {
    setCustomAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);

  const setPersonPercent = useCallback((id: string, value: string): void => {
    setPercentAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);

  const getCustomTotal = useCallback((): number => {
    return selectedPeople.reduce((sum, id) => sum + parseAmount(customAmounts[id] ?? '0'), 0);
  }, [selectedPeople, customAmounts]);

  const getPercentTotal = useCallback((): number => {
    return selectedPeople.reduce((sum, id) => sum + parseAmount(percentAmounts[id] ?? '0'), 0);
  }, [selectedPeople, percentAmounts]);

  const customRemaining = totalAmount - getCustomTotal();
  const percentRemaining = 100 - getPercentTotal();

  const percentPreviewText = useMemo((): string => {
    if (totalAmount <= 0 || Math.abs(getPercentTotal() - 100) >= 0.1) return '';
    let running = 0;
    return selectedPeople
      .map((id, i) => {
        const pct = parseFloat((percentAmounts[id] ?? '0').replace(',', '.')) || 0;
        const isLast = i === selectedPeople.length - 1;
        const share = isLast
          ? Math.round((totalAmount - running) * 100) / 100
          : Math.round((pct / 100) * totalAmount * 100) / 100;
        if (!isLast) running += share;
        return `${housemates.find((h) => h.id === id)?.name ?? id}: ${formatFull(share, currencyCode)}`;
      })
      .join('  ·  ');
  }, [totalAmount, selectedPeople, percentAmounts, housemates, currencyCode, getPercentTotal]);

  const equalSplitPreview = useMemo((): number => {
    if (selectedPeople.length === 0 || totalAmount <= 0) return 0;
    const totalCents = Math.round(totalAmount * 100);
    const n = selectedPeople.length;
    const baseCents = Math.floor(totalCents / n);
    const remainderCents = totalCents - baseCents * n;
    return (baseCents + (remainderCents > 0 ? 1 : 0)) / 100;
  }, [totalAmount, selectedPeople]);

  const fillEquallyCustom = useCallback((): void => {
    const blanks = selectedPeople.filter(
      (id) => customAmounts[id] === undefined || customAmounts[id] === ''
    );
    if (blanks.length === 0) return;
    if (customRemaining < 0.01) return;
    const per = customRemaining / blanks.length;
    let allocated = 0;
    setError('');
    setCustomAmounts((prev) => {
      const updated = { ...prev };
      blanks.forEach((id, i) => {
        const isLast = i === blanks.length - 1;
        const share = isLast
          ? Math.round((customRemaining - allocated) * 100) / 100
          : Math.round(per * 100) / 100;
        updated[id] = share.toFixed(2);
        if (!isLast) allocated += share;
      });
      return updated;
    });
  }, [selectedPeople, customAmounts, customRemaining, setError]);

  const fillEquallyPercent = useCallback((): void => {
    const blanks = selectedPeople.filter(
      (id) => percentAmounts[id] === undefined || percentAmounts[id] === ''
    );
    if (blanks.length === 0) return;
    if (percentRemaining < 0.1) return;
    const per = percentRemaining / blanks.length;
    let allocated = 0;
    setError('');
    setPercentAmounts((prev) => {
      const updated = { ...prev };
      blanks.forEach((id, i) => {
        const isLast = i === blanks.length - 1;
        const share = isLast
          ? Math.round((percentRemaining - allocated) * 10) / 10
          : Math.round(per * 10) / 10;
        updated[id] = share.toString();
        if (!isLast) allocated += share;
      });
      return updated;
    });
  }, [selectedPeople, percentAmounts, percentRemaining, setError]);

  const handleSave = useCallback(async (): Promise<void> => {
    let payload: AddBillPayload;
    try {
      payload = parseAndValidateAddBill({
        title,
        amount,
        paidBy,
        selectedPeople,
        splitType,
        customAmounts,
        percentAmounts,
        category,
        date,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const firstError = err.errors[0];
        const params =
          firstError.code === 'custom'
            ? ((firstError as z.ZodCustomIssue).params as Record<string, string | number>)
            : undefined;
        setError(t(firstError.message, params));
      } else {
        setError(t('bills.failed_save'));
      }
      return;
    }
    if (!houseId) {
      setError(t('bills.failed_save'));
      return;
    }
    try {
      setIsLoading(true);
      await addBill(payload, houseId);
      markSeen('bills').catch(() => {});
      // Reset before navigating so stale state never persists on re-entry
      resetForm(allIds, myId);
      router.replace('/(tabs)/bills');
    } catch (err) {
      captureError(err, { houseId, userId: myId });
      setError(t('bills.failed_save'));
      setIsLoading(false);
    }
  }, [
    title,
    amount,
    paidBy,
    selectedPeople,
    splitType,
    customAmounts,
    percentAmounts,
    category,
    date,
    addBill,
    houseId,
    markSeen,
    resetForm,
    allIds,
    myId,
    t,
  ]);

  if (housematesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <EmptyState mode="loading" title="Loading…" />
        </View>
      </SafeAreaView>
    );
  }

  if (housemates.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <EmptyState mode="empty" icon="people-outline" title={t('bills.no_housemates')} />
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
            onChangeText={(v) => {
              setTitle(v);
              setError('');
            }}
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
            onChangeText={(v) => {
              setAmount(v);
              setError('');
            }}
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
                  {h.name}
                  {h.id === myId ? ` (${t('common.me')})` : ''}
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
                <Text
                  style={[
                    styles.chipText,
                    selectedPeople.includes(h.id) && styles.chipTextSelected,
                  ]}
                >
                  {h.name}
                  {h.id === myId ? ` (${t('common.me')})` : ''}
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
            <View style={styles.chipRow} accessibilityRole="radiogroup">
              <Pressable
                style={[styles.chip, splitType === 'equal' && styles.chipSelected]}
                onPress={() => {
                  setSplitType('equal');
                  setError('');
                }}
                accessible
                accessibilityRole="radio"
                accessibilityLabel={t('bills.equal')}
                accessibilityState={{ selected: splitType === 'equal' }}
              >
                <Text style={[styles.chipText, splitType === 'equal' && styles.chipTextSelected]}>
                  {t('bills.equal')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, splitType === 'custom' && styles.chipSelected]}
                onPress={() => {
                  setSplitType('custom');
                  setError('');
                }}
                accessible
                accessibilityRole="radio"
                accessibilityLabel={t('bills.custom_amounts')}
                accessibilityState={{ selected: splitType === 'custom' }}
              >
                <Text style={[styles.chipText, splitType === 'custom' && styles.chipTextSelected]}>
                  {t('bills.custom_amounts')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, splitType === 'percentage' && styles.chipSelected]}
                onPress={() => {
                  setSplitType('percentage');
                  setError('');
                }}
                accessible
                accessibilityRole="radio"
                accessibilityLabel={t('bills.by_percent')}
                accessibilityState={{ selected: splitType === 'percentage' }}
              >
                <Text
                  style={[styles.chipText, splitType === 'percentage' && styles.chipTextSelected]}
                >
                  {t('bills.by_percent')}
                </Text>
              </Pressable>
            </View>

            {splitType === 'equal' && totalAmount > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewText}>
                  {formatFull(equalSplitPreview, currencyCode)} {t('bills.per_person')}
                </Text>
              </View>
            )}

            {splitType === 'custom' && (
              <View style={styles.customBox}>
                {selectedPeople.map((id) => {
                  const name = housemates.find((h) => h.id === id)?.name ?? id;
                  return (
                    <View key={id} style={styles.customRow}>
                      <Text style={styles.customName}>{name}</Text>
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
                        accessibilityLabel={t('bills.amount_for', { name })}
                        accessibilityHint={t('bills.amount_for_hint')}
                      />
                    </View>
                  );
                })}
                {customRemaining > 0.01 && (
                  <Pressable
                    onPress={fillEquallyCustom}
                    style={styles.fillBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('bills.fill_remaining_equally')}
                  >
                    <Ionicons name="git-branch-outline" size={13} color={C.primary} />
                    <Text style={styles.fillBtnText}>{t('bills.fill_remaining_equally')}</Text>
                  </Pressable>
                )}
                <View style={styles.customTotal}>
                  <Text style={styles.customTotalLabel}>{t('bills.total_entered')}</Text>
                  <Text
                    style={[
                      styles.customTotalValue,
                      {
                        color:
                          Math.abs(getCustomTotal() - totalAmount) < 0.01 ? C.positive : C.danger,
                      },
                    ]}
                  >
                    {formatFull(getCustomTotal(), currencyCode)} /{' '}
                    {formatFull(totalAmount, currencyCode)}
                  </Text>
                </View>
                {totalAmount > 0 && (
                  <View style={styles.customRemainingRow}>
                    <Text style={styles.customTotalLabel}>{t('bills.remaining')}</Text>
                    <Text
                      style={[
                        styles.customTotalValue,
                        {
                          color:
                            customRemaining < -0.01
                              ? C.danger
                              : customRemaining < 0.01
                                ? C.positive
                                : C.textPrimary,
                        },
                      ]}
                    >
                      {customRemaining < -0.01
                        ? t('bills.over_by_amount', {
                            amount: formatFull(-customRemaining, currencyCode),
                          })
                        : formatFull(customRemaining, currencyCode)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {splitType === 'percentage' && (
              <View style={styles.customBox}>
                {selectedPeople.map((id) => {
                  const name = housemates.find((h) => h.id === id)?.name ?? id;
                  return (
                    <View key={id} style={styles.customRow}>
                      <Text style={styles.customName}>{name}</Text>
                      <View style={styles.pctInputRow}>
                        <TextInput
                          value={percentAmounts[id] ?? ''}
                          onChangeText={(v) => setPersonPercent(id, v)}
                          mode="outlined"
                          style={styles.customInput}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          dense
                          outlineColor={C.border}
                          activeOutlineColor={C.primary}
                          accessibilityLabel={t('bills.pct_for', { name })}
                          accessibilityHint={t('bills.pct_for_hint')}
                        />
                        <Text style={styles.pctSymbol}>%</Text>
                      </View>
                    </View>
                  );
                })}
                {percentRemaining > 0.1 && (
                  <Pressable
                    onPress={fillEquallyPercent}
                    style={styles.fillBtn}
                    accessibilityRole="button"
                    accessibilityLabel={t('bills.fill_remaining_equally')}
                  >
                    <Ionicons name="git-branch-outline" size={13} color={C.primary} />
                    <Text style={styles.fillBtnText}>{t('bills.fill_remaining_equally')}</Text>
                  </Pressable>
                )}
                <View style={styles.customTotal}>
                  <Text style={styles.customTotalLabel}>{t('bills.total_percent')}</Text>
                  <Text
                    style={[
                      styles.customTotalValue,
                      { color: Math.abs(getPercentTotal() - 100) < 0.1 ? C.positive : C.danger },
                    ]}
                  >
                    {getPercentTotal().toFixed(1)}% / 100%
                  </Text>
                </View>
                <View style={styles.customRemainingRow}>
                  <Text style={styles.customTotalLabel}>{t('bills.remaining')}</Text>
                  <Text
                    style={[
                      styles.customTotalValue,
                      {
                        color:
                          percentRemaining < -0.1
                            ? C.danger
                            : percentRemaining < 0.1
                              ? C.positive
                              : C.textPrimary,
                      },
                    ]}
                  >
                    {percentRemaining < -0.1
                      ? t('bills.over_by_pct', { pct: (-percentRemaining).toFixed(1) })
                      : `${percentRemaining.toFixed(1)}%`}
                  </Text>
                </View>
                {!!percentPreviewText && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>{percentPreviewText}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.category')}</Text>
          <View style={styles.categoryGroups}>
            {CATEGORY_GROUPS.map((group) => (
              <View key={group.label} style={styles.categoryGroup}>
                <Text style={[styles.categoryGroupLabel, { color: C.textSecondary }]}>
                  {group.label.toUpperCase()}
                </Text>
                <View style={styles.categoryGroupChips}>
                  {group.items.map((cat) => {
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
                </View>
              </View>
            ))}
          </View>
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

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: sizes.lg, gap: sizes.md, paddingBottom: 60 },

    header: { gap: 4, marginBottom: sizes.xs },
    backBtn: {
      alignSelf: 'flex-start',
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
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
      minHeight: 44,
      justifyContent: 'center',
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
    customRemainingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
    pctInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pctSymbol: { fontSize: 16, ...font.semibold, color: C.textPrimary },
    fillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.primary + '40',
      backgroundColor: C.primary + '08',
      minHeight: 44,
    },
    fillBtnText: { color: C.primary, fontSize: 13, ...font.semibold },

    categoryGroups: { gap: sizes.sm },
    categoryGroup: { gap: 6 },
    categoryGroupLabel: { fontSize: 11, ...font.bold, letterSpacing: 0.7 },
    categoryGroupChips: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
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
