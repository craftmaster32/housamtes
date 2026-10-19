import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
import { View, StyleSheet, ScrollView, Pressable, TextInput as RNTextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { goBack } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { useBillsStore } from '@stores/billsStore';
import { useExpenseCategoriesStore } from '@stores/expenseCategoriesStore';
import { BillCategoryPicker } from '@components/bills/BillCategoryPicker';
import { QuickAddCategoryModal } from '@components/bills/QuickAddCategoryModal';
import { captureError } from '@lib/errorTracking';
import { useHousematesStore } from '@stores/housematesStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useBadgeStore } from '@stores/badgeStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { BillTabs } from '@components/bills/BillTabs';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { PersonPicker } from '@components/bills/form/PersonPicker';
import { SplitNote } from '@components/bills/form/SplitNote';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull, splitMoney } from '@constants/currencies';
import { Button, EmptyState } from '@components/ui';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { parseAndValidateAddBill, parseAmount, type AddBillPayload } from '@utils/validation';

import { mf, ms } from '@utils/responsive';
type SplitType = 'equal' | 'custom' | 'percentage';

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

function AddBillScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const currentLanguage = useLanguageStore((s) => s.language);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('semibold');
  const housemates = useHousematesStore((state) => state.housemates);
  const housematesLoading = useHousematesStore((state) => state.isLoading);
  const addBill = useBillsStore((state) => state.addBill);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const markSeen = useBadgeStore((s) => s.markSeen);
  const categories = useExpenseCategoriesStore((s) => s.categories);
  const loadCategories = useExpenseCategoriesStore((s) => s.load);
  const categoriesIsLoading = useExpenseCategoriesStore((s) => s.isLoading);
  const categoriesError = useExpenseCategoriesStore((s) => s.error);
  const handFont = useHandFont();
  const curSymbol = useMemo(() => splitMoney(0, currencyCode).symbol, [currencyCode]);

  const myId = profile?.id ?? '';
  const allIds = useMemo(() => housemates.map((h) => h.id), [housemates]);

  // The category list is DB-backed and shared with the settings manager, so a
  // category added there shows up here without a hardcoded list.
  useEffect((): void => {
    if (houseId) loadCategories(houseId);
  }, [houseId, loadCategories]);

  // Keep the latest categories reachable from the stable reset callback below
  // without making them a dependency (which would re-fire it and wipe a draft).
  const categoriesRef = useRef(categories);
  useEffect((): void => {
    categoriesRef.current = categories;
  }, [categories]);

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
  const [category, setCategory] = useState('');
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
    setCategory(categoriesRef.current[0]?.name ?? '');
    setDate(todayString());
    setSplitType('equal');
    setCustomAmounts({});
    setPercentAmounts({});
    setIsLoading(false);
    setError('');
  }, []);

  // Adding a category happens in a popup on this screen (no navigation), so the
  // in-progress bill is never lost and the new category appears immediately.
  const [showAddCategory, setShowAddCategory] = useState(false);
  const openAddCategory = useCallback((): void => setShowAddCategory(true), []);
  const closeAddCategory = useCallback((): void => setShowAddCategory(false), []);
  const handleCategoryCreated = useCallback((newName: string): void => {
    setCategory(newName);
    setShowAddCategory(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      resetForm(allIdsRef.current, myIdRef.current);
    }, [resetForm])
  );

  // If categories finish loading after this screen is already focused (so the
  // reset ran with an empty list), seed the first one as the default selection.
  useEffect((): void => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0].name);
    }
  }, [categories, category]);

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
    if (isLoading) return; // guard against a fast double-tap creating a duplicate bill
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
      goBack();
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
    isLoading,
  ]);

  if (housematesLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <EmptyState mode="loading" title={t('common.loading')} />
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
          <Pressable onPress={goBack} style={styles.backBtn}>
            <Ionicons
              name={isRTL(currentLanguage) ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color={C.primary}
            />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          <Text style={[styles.heading, headingFont]}>{t('bills.add_title')}</Text>
          <Text style={styles.headingSub}>{t('bills.add_subtitle')}</Text>
        </View>

        {/* Amount, written on a notebook page */}
        <NotebookPaper>
          <Text style={[styles.amountHeroLabel, { color: C.paperMuted }]}>{t('bills.amount')}</Text>
          <View style={styles.amountHeroRow}>
            <Text style={[styles.amountHeroCur, headingFont, { color: C.paperMuted }]}>
              {curSymbol}
            </Text>
            <RNTextInput
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                setError('');
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={C.paperMuted}
              underlineColorAndroid="transparent"
              style={[styles.amountHeroInput, headingFont, { color: C.paperInk }]}
              accessibilityLabel={t('bills.amount')}
              accessibilityHint={t('bills.enter_valid_amount')}
            />
          </View>
        </NotebookPaper>

        {/* Title */}
        <UnderlineInput
          label={t('bills.what_for')}
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            setError('');
          }}
          placeholder={t('bills.what_for_placeholder')}
          accessibilityLabel={t('bills.what_for')}
          accessibilityHint={t('bills.what_for_placeholder')}
        />

        {/* Who paid */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.who_paid')}</Text>
          <PersonPicker
            people={housemates}
            mode="single"
            selected={[paidBy]}
            onPress={setPaidBy}
            meId={myId}
            meSuffix={` (${t('common.me')})`}
          />
        </View>

        {/* Split between */}
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('bills.split_between')}</Text>
            <Pressable
              onPress={() => setSelectedPeople(allIds)}
              style={styles.selectAllBtn}
              accessibilityRole="button"
            >
              <Text style={styles.selectAll}>{t('bills.select_all')}</Text>
            </Pressable>
          </View>
          <PersonPicker
            people={housemates}
            mode="multi"
            selected={selectedPeople}
            onPress={togglePerson}
            meId={myId}
            meSuffix={` (${t('common.me')})`}
          />
          {selectedPeople.length > 0 && (
            <Text style={styles.splitCount}>
              {t('bills.selected', { count: selectedPeople.length })}
            </Text>
          )}
        </View>

        {/* How to split */}
        {selectedPeople.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.label}>{t('bills.how_to_split')}</Text>
            <BillTabs<SplitType>
              role="radio"
              tabs={[
                { key: 'equal', label: t('bills.equal') },
                {
                  key: 'custom',
                  label: t('bills.custom_short'),
                  a11yLabel: t('bills.custom_amounts'),
                },
                { key: 'percentage', label: t('bills.by_percent') },
              ]}
              selected={splitType}
              onSelect={(type) => {
                setSplitType(type);
                setError('');
              }}
            />

            {splitType === 'equal' && totalAmount > 0 && (
              <SplitNote>
                {`${formatFull(equalSplitPreview, currencyCode)} ${t('bills.per_person')}`}
              </SplitNote>
            )}

            {splitType === 'custom' && (
              <View style={styles.customBox}>
                {selectedPeople.map((id) => {
                  const name = housemates.find((h) => h.id === id)?.name ?? id;
                  return (
                    <View key={id} style={styles.customRow}>
                      <Text style={styles.customName}>{name}</Text>
                      <UnderlineInput
                        value={customAmounts[id] ?? ''}
                        onChangeText={(v) => setPersonAmount(id, v)}
                        style={styles.customInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
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
                    <Ionicons name="git-branch-outline" size={15} color={C.primary} />
                    <Text style={[styles.fillBtnText, handFont]}>
                      {t('bills.fill_remaining_equally')}
                    </Text>
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
                      <UnderlineInput
                        value={percentAmounts[id] ?? ''}
                        onChangeText={(v) => setPersonPercent(id, v)}
                        style={styles.customInput}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        suffix="%"
                        accessibilityLabel={t('bills.pct_for', { name })}
                        accessibilityHint={t('bills.pct_for_hint')}
                      />
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
                    <Ionicons name="git-branch-outline" size={15} color={C.primary} />
                    <Text style={[styles.fillBtnText, handFont]}>
                      {t('bills.fill_remaining_equally')}
                    </Text>
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
                {!!percentPreviewText && <SplitNote>{percentPreviewText}</SplitNote>}
              </View>
            )}
          </View>
        )}

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('bills.category')}</Text>
          {categoriesIsLoading ? (
            <EmptyState mode="loading" title={t('common.loading')} />
          ) : categoriesError ? (
            <EmptyState
              mode="error"
              title={categoriesError}
              actionLabel={t('bills.retry')}
              onAction={(): void => {
                if (houseId) loadCategories(houseId);
              }}
            />
          ) : categories.length === 0 ? (
            <EmptyState
              mode="empty"
              icon="pricetag-outline"
              title={t('bills.no_categories_hint', {
                defaultValue: 'No categories yet. Add one in Settings.',
              })}
              actionLabel={t('bills.add_category')}
              onAction={openAddCategory}
            />
          ) : (
            <BillCategoryPicker
              categories={categories}
              selected={category}
              onSelect={setCategory}
              onAddCategory={openAddCategory}
            />
          )}
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
            <Ionicons name="calendar-outline" size={18} color={C.textSecondary} />
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

      <QuickAddCategoryModal
        visible={showAddCategory}
        onClose={closeAddCategory}
        onCreated={handleCategoryCreated}
      />
    </SafeAreaView>
  );
}

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: sizes.lg, gap: ms(22), paddingBottom: ms(60) },

    header: { gap: ms(4), marginBottom: sizes.xs },
    backBtn: {
      alignSelf: 'flex-start',
      minWidth: ms(44),
      minHeight: ms(44),
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: ms(2),
    },
    backText: { color: C.primary, fontSize: mf(15), ...font.semibold },
    heading: { fontSize: mf(36), color: C.textPrimary, letterSpacing: -0.8, lineHeight: mf(42) },
    headingSub: { fontSize: mf(14), ...font.medium, color: C.textSecondary, marginTop: ms(2) },

    amountHeroLabel: { fontSize: mf(16), ...font.bold },
    amountHeroRow: { flexDirection: 'row', alignItems: 'baseline', gap: ms(6), marginTop: ms(10) },
    amountHeroCur: { fontSize: mf(30) },
    // Money stays LTR so digits and symbol don't reorder under Hebrew.
    amountHeroInput: {
      flex: 1,
      minWidth: 0,
      fontSize: mf(52),
      letterSpacing: -1.5,
      padding: 0,
      margin: 0,
      writingDirection: 'ltr',
    },

    field: { gap: ms(10) },
    label: { color: C.textSecondary, ...font.bold, fontSize: mf(13.5) },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectAllBtn: { minHeight: 44, justifyContent: 'center' },
    selectAll: { color: C.primary, fontSize: mf(14), ...font.bold },
    splitCount: { color: C.textSecondary, fontSize: mf(12.5), ...font.medium },

    customBox: { gap: ms(6), marginTop: ms(8) },
    customRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    customName: { flex: 1, color: C.textPrimary, fontSize: mf(15), ...font.medium },
    customInput: { width: ms(110) },
    customTotal: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: sizes.xs,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    customTotalLabel: { color: C.textSecondary, fontSize: mf(14), ...font.medium },
    customTotalValue: { fontSize: mf(14), ...font.semibold },
    customRemainingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: ms(4),
    },
    fillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      alignSelf: 'flex-start',
      minHeight: 44,
    },
    fillBtnText: { color: C.primary, fontSize: mf(20) },

    dateTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(10),
      borderBottomWidth: 1.5,
      borderBottomColor: C.border,
      paddingVertical: ms(10),
      minHeight: 44,
    },
    dateTriggerText: { flex: 1, fontSize: mf(17), ...font.semibold, color: C.textPrimary },

    errorBox: {
      backgroundColor: C.danger + '12',
      borderRadius: ms(10),
      padding: sizes.md,
    },
    errorText: { color: C.danger, fontSize: mf(14), ...font.regular },

    saveBtn: { marginTop: sizes.sm, borderRadius: ms(18) },
  });

export default withFeatureGuard('bills', AddBillScreen);
