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
 * Who has paid what toward the recurring bills: one small card per person with
 * their total, and the difference from an equal share jotted in the corner.
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
        {t('bills.household_contributions')}
      </Text>
      <View style={styles.row}>
        {fairness.map((f) => {
          const mate = housemates.find((h) => h.id === f.person);
          const name = memberName(f.person);
          const balanceColor =
            f.balance > 0 ? c.success : f.balance < 0 ? c.danger : c.textSecondary;
          return (
            <View key={f.person} style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.top}>
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
                <Text style={[styles.balance, handFont, { color: balanceColor }]}>
                  {f.balance >= 0
                    ? `+${currency}${f.balance.toFixed(0)}`
                    : `−${currency}${Math.abs(f.balance).toFixed(0)}`}
                </Text>
              </View>
              <Text style={[styles.name, { color: c.textSecondary }]} numberOfLines={1}>
                {name}
              </Text>
              <Text style={[styles.total, headingFont, { color: c.textPrimary }]}>
                {currency}
                {f.total.toFixed(0)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.note, { color: c.textSecondary }]}>
        {t('bills.household_balance_note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: mf(22), letterSpacing: -0.4, marginBottom: ms(10), paddingHorizontal: ms(4) },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
  card: {
    flexGrow: 1,
    flexBasis: ms(96),
    borderRadius: ms(20),
    paddingHorizontal: ms(12),
    paddingTop: ms(12),
    paddingBottom: ms(10),
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  av: {
    width: ms(30),
    height: ms(30),
    borderRadius: ms(15),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avImg: { width: ms(30), height: ms(30) },
  avText: { fontSize: mf(14), ...font.extrabold, color: '#fff' },
  // Money stays LTR so the sign and symbol don't reorder under Hebrew.
  balance: { fontSize: mf(20), lineHeight: mf(24), writingDirection: 'ltr' },
  name: { fontSize: mf(13), ...font.bold, marginTop: ms(8) },
  total: { fontSize: mf(22), letterSpacing: -0.6, lineHeight: mf(27), writingDirection: 'ltr' },
  note: { fontSize: mf(12.5), ...font.medium, marginTop: ms(8), paddingHorizontal: ms(4) },
});
