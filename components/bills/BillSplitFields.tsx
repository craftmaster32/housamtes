import { useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from '@components/shared/UserAvatar';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { parseAmount } from '@utils/validation';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

export type SplitType = 'equal' | 'custom' | 'percentage';

interface Housemate {
  id: string;
  name: string;
}

interface BillSplitFieldsProps {
  housemates: Housemate[];
  myId: string;
  currencyCode: string;
  totalAmount: number;
  paidBy: string;
  onPaidByChange: (id: string) => void;
  selectedPeople: string[];
  onSelectedPeopleChange: (ids: string[]) => void;
  splitType: SplitType;
  onSplitTypeChange: (type: SplitType) => void;
  customAmounts: Record<string, string>;
  onCustomAmountChange: (id: string, value: string) => void;
  percentAmounts: Record<string, string>;
  onPercentAmountChange: (id: string, value: string) => void;
}

/**
 * The "who paid" / "split between" / "how to split" section of a bill form.
 * Fully controlled so it can back both the add and edit flows with the same
 * split math and previews.
 */
export const BillSplitFields: React.FC<BillSplitFieldsProps> = ({
  housemates,
  myId,
  currencyCode,
  totalAmount,
  paidBy,
  onPaidByChange,
  selectedPeople,
  onSelectedPeopleChange,
  splitType,
  onSplitTypeChange,
  customAmounts,
  onCustomAmountChange,
  percentAmounts,
  onPercentAmountChange,
}) => {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  const allIds = useMemo(() => housemates.map((h) => h.id), [housemates]);

  const togglePerson = useCallback(
    (id: string): void => {
      onSelectedPeopleChange(
        selectedPeople.includes(id)
          ? selectedPeople.filter((p) => p !== id)
          : [...selectedPeople, id]
      );
    },
    [selectedPeople, onSelectedPeopleChange]
  );

  const selectAll = useCallback((): void => {
    onSelectedPeopleChange(allIds);
  }, [allIds, onSelectedPeopleChange]);

  const getCustomTotal = useCallback(
    (): number =>
      selectedPeople.reduce((sum, id) => sum + parseAmount(customAmounts[id] ?? '0'), 0),
    [selectedPeople, customAmounts]
  );

  const getPercentTotal = useCallback(
    (): number =>
      selectedPeople.reduce((sum, id) => sum + parseAmount(percentAmounts[id] ?? '0'), 0),
    [selectedPeople, percentAmounts]
  );

  const customRemaining = totalAmount - getCustomTotal();
  const percentRemaining = 100 - getPercentTotal();

  const equalSplitPreview = useMemo((): number => {
    if (selectedPeople.length === 0 || totalAmount <= 0) return 0;
    const totalCents = Math.round(totalAmount * 100);
    const n = selectedPeople.length;
    const baseCents = Math.floor(totalCents / n);
    const remainderCents = totalCents - baseCents * n;
    return (baseCents + (remainderCents > 0 ? 1 : 0)) / 100;
  }, [totalAmount, selectedPeople]);

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

  const fillEquallyCustom = useCallback((): void => {
    const blanks = selectedPeople.filter(
      (id) => customAmounts[id] === undefined || customAmounts[id] === ''
    );
    if (blanks.length === 0 || customRemaining < 0.01) return;
    const per = customRemaining / blanks.length;
    let allocated = 0;
    blanks.forEach((id, i) => {
      const isLast = i === blanks.length - 1;
      const share = isLast
        ? Math.round((customRemaining - allocated) * 100) / 100
        : Math.round(per * 100) / 100;
      onCustomAmountChange(id, share.toFixed(2));
      if (!isLast) allocated += share;
    });
  }, [selectedPeople, customAmounts, customRemaining, onCustomAmountChange]);

  const fillEquallyPercent = useCallback((): void => {
    const blanks = selectedPeople.filter(
      (id) => percentAmounts[id] === undefined || percentAmounts[id] === ''
    );
    if (blanks.length === 0 || percentRemaining < 0.1) return;
    const per = percentRemaining / blanks.length;
    let allocated = 0;
    blanks.forEach((id, i) => {
      const isLast = i === blanks.length - 1;
      const share = isLast
        ? Math.round((percentRemaining - allocated) * 10) / 10
        : Math.round(per * 10) / 10;
      onPercentAmountChange(id, share.toString());
      if (!isLast) allocated += share;
    });
  }, [selectedPeople, percentAmounts, percentRemaining, onPercentAmountChange]);

  return (
    <View style={styles.wrap}>
      {/* Who paid */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('bills.who_paid')}</Text>
        <View style={styles.chipRow}>
          {housemates.map((h) => {
            const selected = paidBy === h.id;
            return (
              <Pressable
                key={h.id}
                style={[styles.pChip, selected && styles.pChipSelected]}
                onPress={() => onPaidByChange(h.id)}
                accessible
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <UserAvatar userId={h.id} size={24} />
                <Text style={[styles.pChipText, selected && styles.pChipTextSelected]}>
                  {h.name}
                  {h.id === myId ? ` (${t('common.me')})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Split between */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{t('bills.split_between')}</Text>
          <Pressable
            onPress={selectAll}
            style={styles.selectAllBtn}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('bills.select_all')}
          >
            <Text style={styles.selectAll}>{t('bills.select_all')}</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          {housemates.map((h) => {
            const checked = selectedPeople.includes(h.id);
            return (
              <Pressable
                key={h.id}
                style={[styles.pChip, checked && styles.pChipSelected]}
                onPress={() => togglePerson(h.id)}
                accessible
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <UserAvatar userId={h.id} size={24} />
                <Text style={[styles.pChipText, checked && styles.pChipTextSelected]}>
                  {h.name}
                  {h.id === myId ? ` (${t('common.me')})` : ''}
                </Text>
                {checked && <Ionicons name="checkmark" size={15} color={C.primary} />}
              </Pressable>
            );
          })}
        </View>
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
          <View style={styles.segment} accessibilityRole="radiogroup">
            <Pressable
              style={[styles.segItem, splitType === 'equal' && styles.segItemOn]}
              onPress={() => onSplitTypeChange('equal')}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={t('bills.equal')}
              accessibilityState={{ selected: splitType === 'equal' }}
            >
              <Text style={[styles.segText, splitType === 'equal' && styles.segTextOn]}>
                {t('bills.equal')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segItem, splitType === 'custom' && styles.segItemOn]}
              onPress={() => onSplitTypeChange('custom')}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={t('bills.custom_amounts')}
              accessibilityState={{ selected: splitType === 'custom' }}
            >
              <Text
                style={[styles.segText, splitType === 'custom' && styles.segTextOn]}
                numberOfLines={1}
              >
                {t('bills.custom_short')}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segItem, splitType === 'percentage' && styles.segItemOn]}
              onPress={() => onSplitTypeChange('percentage')}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={t('bills.by_percent')}
              accessibilityState={{ selected: splitType === 'percentage' }}
            >
              <Text style={[styles.segText, splitType === 'percentage' && styles.segTextOn]}>
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
                      onChangeText={(v) => onCustomAmountChange(id, v)}
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
                        onChangeText={(v) => onPercentAmountChange(id, v)}
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
    </View>
  );
};

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    wrap: { gap: sizes.md },
    field: { gap: sizes.xs },
    label: { color: C.textPrimary, ...font.semibold, fontSize: mf(14) },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectAll: { color: C.primary, fontSize: mf(13), ...font.semibold },
    selectAllBtn: { minHeight: ms(44), justifyContent: 'center', paddingHorizontal: ms(4) },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.xs },
    pChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      paddingVertical: ms(6),
      paddingStart: ms(6),
      paddingEnd: ms(13),
      minHeight: ms(44),
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    pChipSelected: { borderColor: C.primary, backgroundColor: C.primaryTint },
    pChipText: { color: C.textPrimary, fontSize: mf(14), ...font.semibold },
    pChipTextSelected: { color: C.primary },
    splitCount: { color: C.textSecondary, fontSize: mf(12), ...font.regular, marginTop: ms(2) },
    segment: {
      flexDirection: 'row',
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(12),
      padding: ms(4),
      gap: ms(4),
    },
    segItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: ms(9),
      minHeight: ms(44),
      borderRadius: ms(9),
    },
    segItemOn: {
      backgroundColor: C.primary,
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.28,
      shadowRadius: 6,
      elevation: 2,
    },
    segText: { fontSize: mf(13), ...font.semibold, color: C.textSecondary },
    segTextOn: { color: '#fff' },
    previewBox: {
      backgroundColor: C.primaryTint,
      borderRadius: ms(14),
      paddingVertical: ms(12),
      paddingHorizontal: sizes.md,
      alignItems: 'center',
      marginTop: sizes.sm,
    },
    previewText: { color: C.primary, ...font.bold, fontSize: mf(16) },
    customBox: {
      backgroundColor: C.surface,
      borderRadius: ms(12),
      padding: sizes.md,
      gap: sizes.sm,
      borderWidth: 1,
      borderColor: C.border,
      marginTop: sizes.xs,
    },
    customRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    customName: { flex: 1, color: C.textPrimary, fontSize: mf(15), ...font.medium },
    customInput: { width: ms(110), backgroundColor: C.surface },
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
    pctInputRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
    pctSymbol: { fontSize: mf(16), ...font.semibold, color: C.textPrimary },
    fillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      alignSelf: 'flex-start',
      paddingVertical: ms(6),
      paddingHorizontal: ms(10),
      borderRadius: ms(8),
      borderWidth: 1,
      borderColor: C.primary + '40',
      backgroundColor: C.primary + '08',
      minHeight: ms(44),
    },
    fillBtnText: { color: C.primary, fontSize: mf(13), ...font.semibold },
  });
