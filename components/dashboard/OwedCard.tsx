import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigateToBase } from '@stores/navigationStore';
import { useAuthStore } from '@stores/authStore';
import {
  useBillsStore,
  calculateAllNetBalances,
  calculateSimplifiedBalancesForUser,
} from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors } from '@constants/colors';
import { font, heading } from '@constants/typography';
import { formatFull } from '@constants/currencies';
import { Money } from '@components/shared/Money';
import { NotebookPaper } from '@components/shared/NotebookPaper';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

// "You're owed" — the money summary, drawn as a notebook page.
export function OwedCard(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const bills = useBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const householdMembers = useHousematesStore((s) => s.housemates);
  const myId = profile?.id ?? '';

  const activeBills = bills.filter((b) => !b.settled);
  const combinedNet = new Map<string, number>(calculateAllNetBalances(activeBills));
  for (const { person, balance } of calculateFairness(
    householdBills,
    payments,
    householdMembers.map((h) => h.id)
  )) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }
  const balances = calculateSimplifiedBalancesForUser(combinedNet, myId);
  const totalOwed = balances.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0);
  const totalOwe = balances.filter((b) => b.amount < 0).reduce((s, b) => s + Math.abs(b.amount), 0);
  const netAmount = totalOwed - totalOwe;
  const isOwed = netAmount >= 0;
  const peopleCount = balances.length;
  const settled = balances.length === 0;

  return (
    <Pressable
      style={({ pressed }) => [pressed && styles.pressed]}
      onPress={() => navigateToBase('/(tabs)/bills')}
      accessibilityRole="button"
      accessibilityActions={[
        { name: 'activate' },
        { name: 'viewSpending', label: t('spending.view_spending') },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'viewSpending') {
          router.push('/(tabs)/profile/spending');
        } else {
          navigateToBase('/(tabs)/bills');
        }
      }}
      accessibilityLabel={
        settled
          ? t('dashboard.balance_all_settled')
          : t(isOwed ? 'dashboard.balance_owed_amount' : 'dashboard.balance_you_owe_amount', {
              amount: formatFull(Math.abs(netAmount), currencyCode),
            })
      }
    >
      <NotebookPaper>
        {settled ? (
          <View style={styles.settledRow}>
            <View style={styles.flex1}>
              <Text style={[styles.settledTitle, headingFont, { color: c.paperInk }]}>
                {t('dashboard.balance_all_settled')}
              </Text>
              <Text style={[styles.sub, { color: c.paperMuted }]}>{t('dashboard.no_debts')}</Text>
            </View>
            <View style={[styles.check, { backgroundColor: c.success }]}>
              <Ionicons name="checkmark" size={22} color="#fff" />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.topRow}>
              <Text style={[styles.label, { color: c.paperMuted }]}>
                {isOwed ? t('dashboard.balance_owed') : t('dashboard.balance_you_owe')}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.chartBtn, pressed && styles.pressed]}
                onPress={() => router.push('/(tabs)/profile/spending')}
                accessibilityRole="button"
                accessibilityLabel={t('spending.view_spending')}
              >
                <Ionicons name="stats-chart-outline" size={18} color={c.paperMuted} />
              </Pressable>
            </View>
            <Money
              amount={Math.abs(netAmount)}
              currencyCode={currencyCode}
              size={ms(60)}
              color={c.paperInk}
              mutedColor={c.paperMuted}
              wholeFamily={heading.semibold.fontFamily}
              style={styles.amount}
              animate
            />
            <Text style={[styles.sub, { color: c.paperMuted }]}>
              {peopleCount !== 1
                ? t('dashboard.balance_across_plural', { count: peopleCount })
                : t('dashboard.balance_across', { count: peopleCount })}
            </Text>
          </>
        )}
      </NotebookPaper>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: mf(16), ...font.bold },
  chartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(34,32,29,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: { marginTop: ms(2) },
  sub: { fontSize: mf(15), ...font.medium, lineHeight: mf(21), marginTop: ms(6) },
  settledRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
  settledTitle: { fontSize: mf(24), letterSpacing: -0.4 },
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex1: { flex: 1 },
  pressed: { opacity: 0.92 },
});
