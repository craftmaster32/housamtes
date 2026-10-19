import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useHandFont } from '@hooks/useHandFont';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { font } from '@constants/typography';
import { UserAvatar } from '@components/shared/UserAvatar';
import type { SplitType } from '@components/bills/BillSplitFields';
import { mf, ms } from '@utils/responsive';

interface SplitSummaryProps {
  payerId: string;
  payerName: string;
  splitType: SplitType;
  peopleCount: number;
  totalAmount: number;
  currencyCode: string;
  /** Opens the sheet with the full who-paid / split options. */
  onOpen: () => void;
}

/** Each person's equal share; the first people absorb the leftover cent, like the saved split. */
function equalShare(total: number, count: number): number {
  if (count === 0 || total <= 0) return 0;
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  return (base + (totalCents - base * count > 0 ? 1 : 0)) / 100;
}

/**
 * Splitwise-style summary: "Paid by [Maya] and split [equally]". Equal split
 * between everyone is the default, so most expenses need no extra taps; either
 * chip opens the full options.
 */
export function SplitSummary({
  payerId,
  payerName,
  splitType,
  peopleCount,
  totalAmount,
  currencyCode,
  onOpen,
}: SplitSummaryProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const handFont = useHandFont();
  const howLabel =
    splitType === 'percentage'
      ? t('bills.split_by_percent')
      : splitType === 'custom'
        ? t('bills.split_by_amounts')
        : t('bills.split_equally');
  const note =
    splitType === 'equal' && totalAmount > 0 && peopleCount > 0
      ? t('bills.split_each_people', {
          amount: formatFull(equalShare(totalAmount, peopleCount), currencyCode),
          count: peopleCount,
        })
      : t('bills.split_between_people', { count: peopleCount });

  const chip = (children: React.ReactNode, label: string): React.JSX.Element => (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.chip, { borderColor: c.primary }, pressed && styles.pressed]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('bills.split_change_hint')}
    >
      {children}
    </Pressable>
  );

  return (
    <View>
      <View style={styles.sentence}>
        <Text style={[styles.words, { color: c.textPrimary }]}>{t('bills.paid_by')}</Text>
        {chip(
          <>
            {!!payerId && <UserAvatar userId={payerId} size={ms(24)} />}
            <Text style={[styles.chipText, { color: c.textPrimary }]} numberOfLines={1}>
              {payerName}
            </Text>
          </>,
          `${t('bills.paid_by')} ${payerName}`
        )}
        <Text style={[styles.words, { color: c.textPrimary }]}>{t('bills.split_and_split')}</Text>
        {chip(
          <Text style={[styles.chipText, { color: c.textPrimary }]}>{howLabel}</Text>,
          `${t('bills.split_and_split')} ${howLabel}`
        )}
      </View>
      <Text style={[styles.note, handFont, { color: c.textSecondary }]}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: ms(6) },
  words: { fontSize: mf(17), ...font.bold },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(7),
    minHeight: 44,
    borderWidth: 2,
    borderRadius: 22,
    paddingHorizontal: ms(11),
    maxWidth: '100%',
  },
  chipText: { fontSize: mf(17), ...font.bold, flexShrink: 1 },
  note: { fontSize: mf(20), lineHeight: mf(25), marginTop: ms(6), writingDirection: 'ltr' },
  pressed: { opacity: 0.7 },
});
