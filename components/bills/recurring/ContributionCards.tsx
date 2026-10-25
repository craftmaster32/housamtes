import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useMemberName } from '@hooks/useMemberName';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';

/**
 * Who has paid what toward the recurring bills: one line per person with their
 * total, and the difference from an equal share in pen.
 */
export function ContributionCards(): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();
  const bills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const housemates = useHousematesStore((s) => s.housemates);
  const memberName = useMemberName();
  const currency = useSettingsStore((s) => s.currency);
  const fairness = calculateFairness(
    bills,
    payments,
    housemates.map((h) => h.id)
  );

  if (fairness.length === 0) return null;

  return (
    <View>
      <Text style={[styles.title, headingFont, { color: c.textPrimary }]}>
        {t('spending.who_paid')}
      </Text>
      {fairness.map((f) => {
        const mate = housemates.find((h) => h.id === f.person);
        const name = memberName(f.person);
        const balanceColor = f.balance > 0 ? c.success : f.balance < 0 ? c.danger : c.textSecondary;
        return (
          <View key={f.person} style={[styles.line, { borderBottomColor: c.border }]}>
            <View style={[styles.av, { backgroundColor: mate?.color ?? c.primary }]}>
              {mate?.avatarUrl ? (
                <Image
                  source={{ uri: mate.avatarUrl }}
                  style={styles.avImg}
                  contentFit="cover"
                  accessible
                  accessibilityLabel={name}
                />
              ) : (
                <Text style={styles.avText}>{name[0]?.toUpperCase() ?? '?'}</Text>
              )}
            </View>
            <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.total, { color: c.textPrimary }]}>
              {currency}
              {Math.round(f.total).toLocaleString('en-US')}
            </Text>
            <Text style={[styles.balance, handFont, { color: balanceColor }]}>
              {f.balance >= 0
                ? `+${currency}${Math.round(f.balance).toLocaleString('en-US')}`
                : `−${currency}${Math.round(Math.abs(f.balance)).toLocaleString('en-US')}`}
            </Text>
          </View>
        );
      })}
      <Text style={[styles.note, { color: c.textSecondary }]}>
        {t('bills.household_balance_note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: mf(22), letterSpacing: -0.4, marginBottom: ms(4) },
  // One person per line: face, name, what they paid, +/- in pen.
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(12),
    minHeight: 56,
    borderBottomWidth: 1.5,
  },
  av: {
    width: ms(34),
    height: ms(34),
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avImg: { width: ms(34), height: ms(34) },
  avText: { fontSize: mf(15), ...font.extrabold, color: '#fff' },
  name: { flex: 1, minWidth: 0, fontSize: mf(16), ...font.semibold },
  // Money stays LTR so the sign and symbol don't reorder under Hebrew.
  total: { fontSize: mf(16), ...font.semibold, writingDirection: 'ltr' },
  balance: {
    fontSize: mf(20),
    lineHeight: mf(24),
    minWidth: ms(78),
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  note: { fontSize: mf(12.5), ...font.medium, marginTop: ms(8) },
});
