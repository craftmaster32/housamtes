import { useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BillTabs } from '@components/bills/BillTabs';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { PersonPicker } from '@components/bills/form/PersonPicker';
import { SplitNote } from '@components/bills/form/SplitNote';
import { useHandFont } from '@hooks/useHandFont';
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
  const handFont = useHandFont();

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

  // Equal split isn't always a single figure: with a leftover cent, some people
  // pay one cent more than others. Expose both ends so the preview can show the
  // true range (e.g. "$3.33 – $3.34") instead of rounding everyone up.
  const equalSplitPreview = useMemo((): { low: number; high: number; hasRange: boolean } => {
    if (selectedPeople.length === 0 || totalAmount <= 0)
      return { low: 0, high: 0, hasRange: false };
    const totalCents = Math.round(totalAmount * 100);
    const n = selectedPeople.length;
    const baseCents = Math.floor(totalCents / n);
    const remainderCents = totalCents - baseCents * n;
    return {
      low: baseCents / 100,
      high: (baseCents + (remainderCents > 0 ? 1 : 0)) / 100,
      hasRange: remainderCents > 0,
    };
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
        <PersonPicker
          people={housemates}
          mode="single"
          selected={[paidBy]}
          onPress={onPaidByChange}
          meId={myId}
          meSuffix={` (${t('common.me')})`}
        />
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
            onSelect={onSplitTypeChange}
          />

          {splitType === 'equal' && totalAmount > 0 && (
            <SplitNote>
              {`${
                equalSplitPreview.hasRange
                  ? `${formatFull(equalSplitPreview.low, currencyCode)} – ${formatFull(
                      equalSplitPreview.high,
                      currencyCode
                    )}`
                  : formatFull(equalSplitPreview.high, currencyCode)
              } ${t('bills.per_person')}`}
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
                      onChangeText={(v) => onCustomAmountChange(id, v)}
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
                      onChangeText={(v) => onPercentAmountChange(id, v)}
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
    </View>
  );
};

const makeStyles = (C: ColorTokens) =>
  StyleSheet.create({
    wrap: { gap: ms(22) },
    field: { gap: ms(10) },
    label: { color: C.textSecondary, ...font.bold, fontSize: mf(13.5) },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectAll: { color: C.primary, fontSize: mf(14), ...font.bold },
    selectAllBtn: { minHeight: ms(44), justifyContent: 'center', paddingHorizontal: ms(4) },
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
  });
