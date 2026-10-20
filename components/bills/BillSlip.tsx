import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { getPersonShare, type Bill } from '@stores/billsStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useMemberName } from '@hooks/useMemberName';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { localizeCategoryName } from '@utils/categoryName';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { font, heading } from '@constants/typography';
import { Money } from '@components/shared/Money';
import { DotLeader } from '@components/shared/DotLeader';
import { Stamp } from '@components/shared/Stamp';
import { UserAvatar } from '@components/shared/UserAvatar';
import { ReceiptRoll } from '@components/bills/ReceiptRoll';
import { mf, ms } from '@utils/responsive';

const CUT_DASHES = Array.from({ length: 40 });

interface BillSlipProps {
  bill: Bill;
  categoryIcon: React.ComponentProps<typeof Ionicons>['name'];
  /** The bill's date, already formatted for the reader's language. */
  dateLabel: string;
  /** "Equal ÷ 3", "Custom split", … */
  splitLabel: string;
}

// A dashed "cut here" line with a pair of scissors at the start.
function CutLine(): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={styles.cut} accessibilityElementsHidden importantForAccessibility="no">
      <Ionicons name="cut-outline" size={15} color={c.receiptMuted} style={styles.scissors} />
      <View style={styles.cutDashes}>
        {CUT_DASHES.map((_, i) => (
          <View key={i} style={[styles.cutDash, { backgroundColor: c.receiptRule }]} />
        ))}
      </View>
    </View>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  const c = useThemedColors();
  return (
    <View style={styles.kv}>
      <Text style={[styles.kvLabel, { color: c.receiptMuted }]}>{label}</Text>
      <DotLeader color={c.receiptRule} />
      <View style={styles.kvValue}>{children}</View>
    </View>
  );
}

/**
 * A bill's details printed as a receipt slip: the big total, dotted
 * label/value rows, a cut line, then who owes what. A settled bill gets a big
 * green rubber stamp across it.
 */
export function BillSlip({
  bill,
  categoryIcon,
  dateLabel,
  splitLabel,
}: BillSlipProps): React.JSX.Element {
  const c = useThemedColors();
  const { t, i18n } = useTranslation();
  const headingFont = useHeadingFont('semibold');
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const memberName = useMemberName();
  const ink = bill.settled ? c.receiptMuted : c.receiptInk;

  return (
    <ReceiptRoll contentStyle={styles.body}>
      <Text style={[styles.title, headingFont, { color: ink }]} numberOfLines={2}>
        {bill.title}
      </Text>
      <Money
        amount={bill.amount}
        currencyCode={currencyCode}
        size={ms(52)}
        color={ink}
        mutedColor={c.receiptMuted}
        wholeFamily={heading.semibold.fontFamily}
        style={styles.amount}
      />

      {bill.settled && (
        <Stamp big color={c.success} style={[styles.stamp, { backgroundColor: c.receipt }]}>
          {`✓ ${t('bills.settled_by_on', {
            name: bill.settledBy ? memberName(bill.settledBy) : '',
            date: bill.settledAt
              ? new Date(bill.settledAt).toLocaleDateString(i18n.language || undefined)
              : '',
          })}`}
        </Stamp>
      )}

      <CutLine />

      <Row label={t('bills.category')}>
        <Ionicons name={categoryIcon} size={16} color={c.receiptInk} />
        <Text style={[styles.kvText, { color: c.receiptInk }]} numberOfLines={1}>
          {localizeCategoryName(bill.category, t)}
        </Text>
      </Row>
      <Row label={t('bills.date')}>
        <Text style={[styles.kvText, { color: c.receiptInk }]}>{dateLabel}</Text>
      </Row>
      <Row label={t('bills.paid_by')}>
        <UserAvatar userId={bill.paidBy} size={22} />
        <Text style={[styles.kvText, { color: c.receiptInk }]} numberOfLines={1}>
          {memberName(bill.paidBy)}
        </Text>
      </Row>
      {bill.notes ? (
        <View style={styles.notes}>
          <Text style={[styles.kvLabel, { color: c.receiptMuted }]}>{t('bills.notes_label')}</Text>
          <Text style={[styles.kvText, styles.notesText, { color: c.receiptInk }]} selectable>
            {bill.notes}
          </Text>
        </View>
      ) : null}

      <CutLine />

      <Text style={[styles.splitTitle, headingFont, { color: c.receiptInk }]}>
        {t('bills.split_breakdown')}
      </Text>
      <Text style={[styles.splitTotal, { color: c.receiptMuted }]}>
        {t('bills.total')} {formatFull(bill.amount, currencyCode)} · {splitLabel}
      </Text>
      {bill.splitBetween.map((person) => (
        <View key={person} style={styles.splitRow}>
          <UserAvatar userId={person} size={26} />
          <Text style={[styles.splitPerson, { color: c.receiptInk }]} numberOfLines={1}>
            {memberName(person)}
          </Text>
          <Text style={[styles.splitAmount, headingFont, { color: c.receiptInk }]}>
            {formatFull(getPersonShare(bill, person), currencyCode)}
          </Text>
        </View>
      ))}
    </ReceiptRoll>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: ms(22), paddingTop: ms(14), paddingBottom: ms(18) },
  title: { fontSize: mf(26), letterSpacing: -0.6, lineHeight: mf(31) },
  // Money stays LTR so digits and symbol don't reorder under Hebrew.
  amount: { marginTop: ms(6), writingDirection: 'ltr' },
  stamp: { position: 'absolute', end: ms(16), top: ms(74), maxWidth: '55%' },
  cut: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: ms(12),
    marginHorizontal: -ms(22),
  },
  scissors: { marginHorizontal: ms(10) },
  cutDashes: { flex: 1, flexDirection: 'row', gap: ms(4), overflow: 'hidden' },
  cutDash: { width: ms(6), height: 1.5, borderRadius: 1 },
  kv: { flexDirection: 'row', alignItems: 'center', paddingVertical: ms(8) },
  kvLabel: { fontSize: mf(15), ...font.semibold },
  kvValue: { flexDirection: 'row', alignItems: 'center', gap: ms(6), flexShrink: 1 },
  kvText: { fontSize: mf(15), ...font.bold, flexShrink: 1 },
  notes: { paddingVertical: ms(8), gap: ms(2) },
  notesText: { ...font.medium },
  splitTitle: { fontSize: mf(19), letterSpacing: -0.3 },
  splitTotal: { fontSize: mf(13.5), ...font.medium, marginTop: ms(2), marginBottom: ms(6) },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: ms(6) },
  splitPerson: { flex: 1, fontSize: mf(15), ...font.semibold },
  splitAmount: { fontSize: mf(17), letterSpacing: -0.2, writingDirection: 'ltr' },
});
