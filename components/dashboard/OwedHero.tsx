import { useMemo } from 'react';
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
import { useMemberName } from '@hooks/useMemberName';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { formatFull } from '@constants/currencies';
import { Money } from '@components/shared/Money';
import { UserAvatar } from '@components/shared/UserAvatar';
import { mf, ms } from '@utils/responsive';

// How many housemates get named in the one-line summary before "+N more".
const NAMED_PEOPLE = 2;
const MAX_FACES = 4;

/**
 * The home screen's one big thing: what you're owed (or owe) across every bill,
 * said as a sentence with the people's faces, and one clear "Settle up" button.
 */
export function OwedHero(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const isDark = c.background === darkColors.background;
  const s = useMemo(() => makeStyles(c, isDark), [c, isDark]);
  const memberName = useMemberName();
  const currencyCode = useSettingsStore((st) => st.currencyCode);
  const bills = useBillsStore((st) => st.bills);
  const profile = useAuthStore((st) => st.profile);
  const householdBills = useRecurringBillsStore((st) => st.bills);
  const payments = useRecurringBillsStore((st) => st.payments);
  const householdMembers = useHousematesStore((st) => st.housemates);
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
  const totalOwed = balances.filter((b) => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
  const totalOwe = balances
    .filter((b) => b.amount < 0)
    .reduce((sum, b) => sum + Math.abs(b.amount), 0);
  const netAmount = totalOwed - totalOwe;
  const isOwed = netAmount >= 0;
  const settled = balances.length === 0;

  // Biggest amounts first, so the sentence names the people who matter most.
  const people = [...balances].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const summary = [
    ...people.slice(0, NAMED_PEOPLE).map((b) => {
      const name = memberName(b.person).split(' ')[0];
      const amount = formatFull(Math.abs(b.amount), currencyCode);
      return b.amount > 0
        ? t('dashboard.owes_you', { name, amount })
        : t('dashboard.you_owe_person', { name, amount });
    }),
    people.length > NAMED_PEOPLE
      ? t('dashboard.and_more', { count: people.length - NAMED_PEOPLE })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const goToBills = (): void => navigateToBase('/(tabs)/bills');

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <Text style={s.label}>
          {settled
            ? t('dashboard.balance_all_settled')
            : isOwed
              ? t('dashboard.balance_owed')
              : t('dashboard.balance_you_owe')}
        </Text>
        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && s.pressed]}
          onPress={() => router.push('/(tabs)/profile/spending')}
          accessibilityRole="button"
          accessibilityLabel={t('spending.view_spending')}
        >
          <Ionicons name="stats-chart-outline" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => pressed && s.pressed}
        onPress={goToBills}
        accessibilityRole="button"
        accessibilityLabel={
          settled
            ? t('dashboard.balance_all_settled')
            : t(isOwed ? 'dashboard.balance_owed_amount' : 'dashboard.balance_you_owe_amount', {
                amount: formatFull(Math.abs(netAmount), currencyCode),
              })
        }
      >
        {settled ? (
          <View style={s.settledRow}>
            <Ionicons name="checkmark-circle" size={30} color="#FFFFFF" />
            <Text style={s.settledText}>{t('dashboard.no_debts')}</Text>
          </View>
        ) : (
          <>
            <Money
              amount={Math.abs(netAmount)}
              currencyCode={currencyCode}
              size={ms(52)}
              color="#FFFFFF"
              style={s.amount}
              animate
            />
            <View style={s.peopleRow}>
              <View style={s.faces}>
                {people.slice(0, MAX_FACES).map((b, i) => (
                  <View key={b.person} style={[s.face, i > 0 && s.faceOverlap]}>
                    <UserAvatar userId={b.person} size={ms(26)} />
                  </View>
                ))}
              </View>
              <Text style={s.summary} numberOfLines={2}>
                {summary}
              </Text>
            </View>
          </>
        )}
      </Pressable>
      {!settled && (
        <Pressable
          style={({ pressed }) => [s.settleBtn, pressed && s.pressed]}
          onPress={goToBills}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.settle_up')}
        >
          <Text style={s.settleText}>{t('dashboard.settle_up')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeStyles(c: ColorTokens, isDark: boolean): ReturnType<typeof StyleSheet.create> {
  // Flat brand blue (no gradient). Dark mode uses the deeper navy-blue so white
  // text keeps its contrast without glowing.
  const bg = isDark ? c.owedGradient[0] : c.primary;
  return StyleSheet.create({
    card: { backgroundColor: bg, borderRadius: ms(28), padding: ms(20), paddingBottom: ms(18) },
    pressed: { opacity: 0.92 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontSize: mf(16), ...font.medium, color: '#FFFFFF' },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
      marginEnd: ms(-6),
      marginTop: ms(-6),
    },
    amount: { marginTop: ms(2) },
    peopleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10), marginTop: ms(8) },
    faces: { flexDirection: 'row' },
    face: { borderRadius: ms(15), borderWidth: 2, borderColor: '#FFFFFF' },
    faceOverlap: { marginStart: ms(-8) },
    summary: { flex: 1, fontSize: mf(14), ...font.medium, color: '#FFFFFF', lineHeight: mf(19) },
    settleBtn: {
      alignSelf: 'flex-start',
      minHeight: 44,
      paddingHorizontal: ms(22),
      borderRadius: 22,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: ms(16),
    },
    settleText: { fontSize: mf(16), ...font.semibold, color: isDark ? c.owedFg : c.primaryDark },
    settledRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10), marginTop: ms(10) },
    settledText: { flex: 1, fontSize: mf(17), ...font.semibold, color: '#FFFFFF' },
  });
}
