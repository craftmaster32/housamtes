import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect, Link } from 'expo-router';
import { goBack } from '@stores/navigationStore';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { BillReceipt } from '@components/bills/BillReceipt';
import { BillSplitFields, type SplitType } from '@components/bills/BillSplitFields';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useBillsStore, getPersonShare, CATEGORIES } from '@stores/billsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { parseAndValidateAddBill, parseAmount, type AddBillPayload } from '@utils/validation';
import { useBadgeStore } from '@stores/badgeStore';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useMemberName } from '@hooks/useMemberName';
import { localizeCategoryName } from '@utils/categoryName';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Money } from '@components/shared/Money';
import { Button, EmptyState, Pill } from '@components/ui';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';
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

export default function BillDetailScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const currentLanguage = useLanguageStore((s) => s.language);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont('bold');
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBillsStore((s) => s.bills.find((b) => b.id === id));
  const isLoading = useBillsStore((s) => s.isLoading);
  const storeError = useBillsStore((s) => s.error);
  const editBill = useBillsStore((s) => s.editBill);
  const deleteBill = useBillsStore((s) => s.deleteBill);
  const houseId = useAuthStore((s) => s.houseId);
  const role = useAuthStore((s) => s.role);
  const profile = useAuthStore((s) => s.profile);
  const myId = profile?.id ?? '';
  const canDelete = role === 'owner' || role === 'admin';
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const markSeen = useBadgeStore((s) => s.markSeen);

  useFocusEffect(
    useCallback(() => {
      markSeen('bills').catch(() => {});
    }, [markSeen])
  );

  const housemates = useHousematesStore((s) => s.housemates);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(bill?.title ?? '');
  const [amount, setAmount] = useState(bill?.amount.toString() ?? '');
  const [date, setDate] = useState(bill?.date ?? '');
  const [notes, setNotes] = useState(bill?.notes ?? '');
  const [category, setCategory] = useState(bill?.category ?? 'Other');
  const [paidBy, setPaidBy] = useState(bill?.paidBy ?? '');
  const [selectedPeople, setSelectedPeople] = useState<string[]>(bill?.splitBetween ?? []);
  const [splitType, setSplitType] = useState<SplitType>(bill?.splitAmounts ? 'custom' : 'equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [percentAmounts, setPercentAmounts] = useState<Record<string, string>>({});

  // Sync form back to bill data when not editing (covers async load + cancel)
  useEffect(() => {
    if (!isEditing && bill) {
      setTitle(bill.title);
      setAmount(bill.amount.toString());
      setDate(bill.date);
      setNotes(bill.notes ?? '');
      setCategory(bill.category ?? 'Other');
      setPaidBy(bill.paidBy);
      setSelectedPeople(bill.splitBetween);
      // A saved custom split seeds the custom inputs; an equal split starts blank.
      setSplitType(bill.splitAmounts ? 'custom' : 'equal');
      setCustomAmounts(
        bill.splitAmounts
          ? Object.fromEntries(Object.entries(bill.splitAmounts).map(([id, v]) => [id, String(v)]))
          : {}
      );
      setPercentAmounts({});
    }
  }, [bill, isEditing]);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const openDatePicker = useCallback((): void => setShowDatePicker(true), []);
  const closeDatePicker = useCallback((): void => setShowDatePicker(false), []);
  const handleBackToBills = useCallback((): void => {
    router.replace('/(tabs)/bills');
  }, []);

  const setPersonAmount = useCallback((id: string, value: string): void => {
    setCustomAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);
  const setPersonPercent = useCallback((id: string, value: string): void => {
    setPercentAmounts((prev) => ({ ...prev, [id]: value }));
    setError('');
  }, []);
  const handlePaidByChange = useCallback((id: string): void => {
    setPaidBy(id);
    setError('');
  }, []);
  const handleSelectedPeopleChange = useCallback((ids: string[]): void => {
    setSelectedPeople(ids);
    setError('');
  }, []);
  const handleSplitTypeChange = useCallback((type: SplitType): void => {
    setSplitType(type);
    setError('');
  }, []);

  const handleSaveEdit = useCallback(async (): Promise<void> => {
    if (isSaving || isDeleting) return;
    if (!bill || !houseId) return;
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
        const first = err.errors[0];
        const params =
          first.code === 'custom'
            ? ((first as z.ZodCustomIssue).params as Record<string, string | number>)
            : undefined;
        setError(t(first.message, params));
      } else {
        setError(t('bills.failed_save'));
      }
      return;
    }
    try {
      setIsSaving(true);
      await editBill(
        bill.id,
        {
          title: payload.title,
          amount: payload.amount,
          date: payload.date,
          notes,
          category: payload.category,
          paidBy: payload.paidBy,
          splitBetween: payload.splitBetween,
          splitAmounts: payload.splitAmounts,
        },
        houseId
      );
      setError('');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      setError(t('bills.failed_save'));
    } finally {
      setIsSaving(false);
    }
  }, [
    bill,
    houseId,
    title,
    amount,
    date,
    notes,
    category,
    paidBy,
    selectedPeople,
    splitType,
    customAmounts,
    percentAmounts,
    editBill,
    t,
    isSaving,
    isDeleting,
  ]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!bill || !houseId || isDeleting || isSaving) return;
    try {
      setIsDeleting(true);
      await deleteBill(bill.id, houseId);
      router.replace('/(tabs)/bills');
    } catch (err) {
      console.error(err);
      setError(t('bills.failed_delete'));
      setIsDeleting(false);
    }
  }, [bill, houseId, isDeleting, isSaving, deleteBill, t]);

  const handleBack = useCallback((): void => {
    goBack();
  }, []);
  const handleStartEditing = useCallback((): void => {
    setIsEditing(true);
    setError('');
  }, []);
  const handleCancel = useCallback((): void => {
    setIsEditing(false);
    setError('');
  }, []);
  const handleTitleChange = useCallback((v: string): void => {
    setTitle(v);
    setError('');
  }, []);
  const handleAmountChange = useCallback((v: string): void => {
    setAmount(v);
    setError('');
  }, []);

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <EmptyState
            mode={isLoading ? 'loading' : storeError ? 'error' : 'empty'}
            icon="receipt-outline"
            title={isLoading ? t('common.loading') : (storeError ?? t('bills.bill_not_found'))}
            actionLabel={isLoading ? undefined : t('bills.back_to_bills')}
            onAction={isLoading ? undefined : handleBackToBills}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isCustomSplit = !!bill.splitAmounts;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons
              name={isRTL(currentLanguage) ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color={C.primary}
            />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </Pressable>
          {!bill.settled && !isEditing && !isDeleting && (
            <Pressable
              onPress={handleStartEditing}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
            >
              <Text style={styles.editText}>{t('common.edit')}</Text>
            </Pressable>
          )}
        </View>

        {/* Status banner */}
        {bill.settled && (
          <Pill tone="success" size="md" icon="checkmark-circle-outline">
            {t('bills.settled_by_on', {
              name: bill.settledBy ? memberName(bill.settledBy) : '',
              date: bill.settledAt ? new Date(bill.settledAt).toLocaleDateString() : '',
            })}
          </Pill>
        )}

        {/* Detail / Edit form */}
        {isEditing ? (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, headingFont]}>{t('bills.edit_bill')}</Text>
            <TextInput
              label={t('bills.title_label')}
              value={title}
              onChangeText={handleTitleChange}
              mode="outlined"
              style={styles.input}
              accessibilityLabel={t('bills.title_label')}
              accessibilityHint={t('bills.title_hint')}
            />
            <TextInput
              label={t('bills.amount_label')}
              value={amount}
              onChangeText={handleAmountChange}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
              accessibilityLabel={t('bills.amount_label')}
              accessibilityHint={t('bills.amount_hint')}
            />
            <BillSplitFields
              housemates={housemates}
              myId={myId}
              currencyCode={currencyCode}
              totalAmount={parseAmount(amount)}
              paidBy={paidBy}
              onPaidByChange={handlePaidByChange}
              selectedPeople={selectedPeople}
              onSelectedPeopleChange={handleSelectedPeopleChange}
              splitType={splitType}
              onSplitTypeChange={handleSplitTypeChange}
              customAmounts={customAmounts}
              onCustomAmountChange={setPersonAmount}
              percentAmounts={percentAmounts}
              onPercentAmountChange={setPersonPercent}
            />
            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>{t('bills.date_label')}</Text>
              <Pressable
                style={styles.dateTrigger}
                onPress={openDatePicker}
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
            <TextInput
              label={t('bills.notes_label')}
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              style={styles.input}
              placeholder={t('bills.notes_placeholder')}
              multiline
              numberOfLines={2}
              accessibilityLabel={t('bills.notes_label')}
              accessibilityHint={t('bills.notes_hint')}
            />
            <View style={styles.categoryField}>
              <Text style={styles.categoryFieldLabel}>{t('bills.category')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
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
                <Link href="/(tabs)/settings/categories" asChild>
                  <Pressable
                    style={styles.catChipAdd}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('bills.add_category')}
                  >
                    <Ionicons name="add" size={15} color={C.primary} />
                    <Text style={styles.catChipAddText}>{t('bills.add_category')}</Text>
                  </Pressable>
                </Link>
              </ScrollView>
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.editButtons}>
              <Button
                variant="primary"
                onPress={handleSaveEdit}
                loading={isSaving}
                disabled={isSaving}
                style={styles.saveBtn}
              >
                {t('common.save')}
              </Button>
              <Button variant="ghost" onPress={handleCancel} disabled={isSaving}>
                {t('common.cancel')}
              </Button>
            </View>
          </View>
        ) : (
          <View>
            <LinearGradient
              colors={C.owedGradient}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={styles.detailHero}
            >
              <View style={styles.detailHeroHighlight} />
              <Text style={styles.detailHeroTitle} numberOfLines={2}>
                {bill.title}
              </Text>
              <Money
                amount={bill.amount}
                currencyCode={currencyCode}
                size={40}
                color="#fff"
                style={styles.detailHeroAmount}
              />
            </LinearGradient>
            <View style={[styles.card, styles.detailMetaCard]}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('bills.category')}</Text>
                <View style={styles.metaValueRow}>
                  <View style={styles.catPill}>
                    <Ionicons
                      name={CATEGORY_ICONS[bill.category?.toLowerCase() ?? ''] ?? 'receipt-outline'}
                      size={16}
                      color={C.primary}
                    />
                  </View>
                  <Text style={styles.metaValue}>{localizeCategoryName(bill.category, t)}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('bills.date')}</Text>
                <Text style={styles.metaValue}>{formatDisplayDate(bill.date, i18n.language)}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('bills.paid_by')}</Text>
                <View style={styles.metaValueRow}>
                  <UserAvatar userId={bill.paidBy} size={24} />
                  <Text style={styles.metaValue}>{memberName(bill.paidBy)}</Text>
                </View>
              </View>
              {bill.notes ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t('bills.notes_label')}</Text>
                  <Text style={styles.metaValue} selectable>
                    {bill.notes}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Split breakdown */}
        {!isEditing && (
          <View style={styles.card}>
            <Text style={[styles.sectionTitle, headingFont]}>{t('bills.split_breakdown')}</Text>
            <Text style={styles.splitTotal}>
              {t('bills.total')} {formatFull(bill.amount, currencyCode)} ·{' '}
              {isCustomSplit
                ? t('bills.custom_split')
                : t('bills.equal_split_count', { count: bill.splitBetween.length })}
            </Text>
            {bill.splitBetween.map((person) => (
              <View key={person} style={styles.splitRow}>
                <UserAvatar userId={person} size={26} />
                <Text style={styles.splitPerson}>{memberName(person)}</Text>
                <Text style={styles.splitAmount}>
                  {formatFull(getPersonShare(bill, person), currencyCode)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Receipt */}
        {!isEditing && bill.receiptUrl ? <BillReceipt receiptUrl={bill.receiptUrl} /> : null}

        {/* Actions */}
        {!isEditing && canDelete && !bill.settled && (
          <Button
            variant="danger"
            onPress={handleDelete}
            loading={isDeleting}
            disabled={isDeleting}
            fullWidth
            size="lg"
            style={styles.deleteBtn}
          >
            {t('bills.delete_bill')}
          </Button>
        )}

        {!!error && !isEditing && <Text style={styles.error}>{error}</Text>}
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
    content: { padding: sizes.lg, gap: sizes.md, paddingBottom: sizes.xxl },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sizes.md },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: sizes.xs,
    },
    backBtn: {
      minWidth: ms(44),
      minHeight: ms(44),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(2),
    },
    editBtn: {
      minWidth: ms(44),
      minHeight: ms(44),
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: { color: C.primary, fontSize: mf(15), ...font.medium },
    editText: { color: C.primary, fontSize: mf(15), ...font.medium },
    card: {
      backgroundColor: C.surface,
      borderRadius: ms(16),
      padding: sizes.lg,
      gap: sizes.sm,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 2,
    },
    detailHero: {
      borderRadius: ms(20),
      padding: ms(22),
      gap: ms(4),
      overflow: 'hidden',
      shadowColor: C.owedShadow,
      shadowOffset: { width: 0, height: ms(12) },
      shadowOpacity: 1,
      shadowRadius: 22,
      elevation: 8,
    },
    detailHeroHighlight: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: ms(1),
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    detailHeroTitle: { fontSize: mf(15), ...font.semibold, color: 'rgba(255,255,255,0.85)' },
    detailHeroAmount: { marginTop: ms(2) },
    detailMetaCard: { marginTop: ms(12) },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: ms(6),
    },
    metaLabel: { color: C.textSecondary, fontSize: mf(14), ...font.regular },
    metaValueRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), flexShrink: 1 },
    metaValue: {
      color: C.textPrimary,
      fontSize: mf(14),
      ...font.semibold,
      flexShrink: 1,
      textAlign: 'right',
    },
    catPill: {
      width: ms(30),
      height: ms(30),
      borderRadius: ms(9),
      backgroundColor: C.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: { color: C.textPrimary, fontSize: mf(18), marginBottom: sizes.xs },
    splitTotal: { color: C.textSecondary, fontSize: mf(14), ...font.regular },
    splitRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, paddingVertical: ms(5) },
    splitPerson: { flex: 1, color: C.textPrimary, fontSize: mf(15), ...font.medium },
    splitAmount: { color: C.primary, fontSize: mf(15), ...font.semibold },
    input: { backgroundColor: C.surface },
    dateField: { gap: ms(4) },
    dateFieldLabel: {
      fontSize: mf(12),
      ...font.semibold,
      color: C.textSecondary,
      marginStart: ms(4),
    },
    dateTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sizes.sm,
      backgroundColor: C.surface,
      borderRadius: ms(4),
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: ms(14),
      paddingVertical: ms(14),
      minHeight: ms(56),
    },
    dateTriggerText: { flex: 1, fontSize: mf(15), ...font.regular, color: C.textPrimary },
    editButtons: { flexDirection: 'row', gap: sizes.sm, alignItems: 'center', marginTop: sizes.xs },
    saveBtn: { borderRadius: ms(14) },
    deleteBtn: { borderRadius: ms(14) },
    error: { color: C.danger, fontSize: sizes.fontSm, ...font.regular },

    categoryField: { gap: ms(4) },
    categoryFieldLabel: {
      fontSize: mf(12),
      ...font.semibold,
      color: C.textSecondary,
      marginStart: ms(4),
    },
    categoryScroll: { gap: sizes.xs, paddingVertical: ms(2) },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(5),
      paddingVertical: ms(10),
      paddingHorizontal: ms(12),
      minHeight: ms(44),
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderColor: C.primary + '55',
      backgroundColor: C.primary + '08',
    },
    catChipSelected: { backgroundColor: C.primary, borderColor: C.primary },
    catChipText: { color: C.primary, fontSize: mf(13), ...font.semibold },
    catChipTextSelected: { color: C.white },
    catChipAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(5),
      paddingVertical: ms(10),
      paddingHorizontal: ms(12),
      minHeight: ms(44),
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderStyle: 'dashed' as const,
      borderColor: C.primary + '55',
      backgroundColor: 'transparent',
    },
    catChipAddText: { color: C.primary, fontSize: mf(13), ...font.semibold },
  });
