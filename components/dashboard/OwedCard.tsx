import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, type LayoutChangeEvent } from 'react-native';
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
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useThemedColors } from '@constants/colors';
import { font, heading } from '@constants/typography';
import { formatFull } from '@constants/currencies';
import { Money } from '@components/shared/Money';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { mf, ms } from '@utils/responsive';

// Notebook ruling: a faint blue line every RULE_GAP, starting below the top edge.
const RULE_GAP = ms(32);
const RULE_TOP = ms(44);
// The scalloped tear along the bottom, like a page pulled from a pad.
const SCALLOP = ms(12);

// "You're owed" — the money summary, drawn as a notebook page.
export function OwedCard(): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const bills = useBillsStore((s) => s.bills);
  const profile = useAuthStore((s) => s.profile);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const householdMembers = useHousematesStore((s) => s.housemates);
  const myId = profile?.id ?? '';
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = useCallback((e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

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

  const ruleCount =
    size.h > RULE_TOP ? Math.floor((size.h - RULE_TOP - SCALLOP) / RULE_GAP) + 1 : 0;
  const scallopCount = size.w > 0 ? Math.ceil(size.w / SCALLOP) + 1 : 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={() => navigateToBase('/(tabs)/bills')}
      accessibilityRole="button"
      accessibilityLabel={
        settled
          ? t('dashboard.balance_all_settled')
          : t(isOwed ? 'dashboard.balance_owed_amount' : 'dashboard.balance_you_owe_amount', {
              amount: formatFull(Math.abs(netAmount), currencyCode),
            })
      }
    >
      <View style={[styles.page, { backgroundColor: c.paper }]} onLayout={onLayout}>
        {/* Ruled lines + the red margin line, drawn behind the content. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: ruleCount }, (_, i) => (
            <View
              key={i}
              style={[styles.rule, { top: RULE_TOP + i * RULE_GAP, backgroundColor: c.paperRule }]}
            />
          ))}
          <View
            style={[
              styles.margin,
              rtl ? styles.marginRTL : styles.marginLTR,
              { backgroundColor: c.paperMargin },
            ]}
          />
        </View>

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
      </View>
      {/* Scalloped tear: dots of the page colour hanging off the bottom edge. */}
      <View style={styles.scallops} pointerEvents="none">
        {Array.from({ length: scallopCount }, (_, i) => (
          <View key={i} style={[styles.scallop, { backgroundColor: c.paper }]} />
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(14) },
    shadowOpacity: 0.16,
    shadowRadius: ms(18),
    elevation: 6,
  },
  page: {
    borderTopLeftRadius: ms(22),
    borderTopRightRadius: ms(22),
    paddingHorizontal: ms(24),
    paddingTop: ms(20),
    paddingBottom: ms(18),
    overflow: 'hidden',
  },
  rule: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth * 2 },
  margin: { position: 'absolute', top: 0, bottom: 0, width: 1.5 },
  marginLTR: { left: ms(14) },
  marginRTL: { right: ms(14) },
  scallops: { flexDirection: 'row', height: SCALLOP / 2, overflow: 'hidden' },
  scallop: {
    width: SCALLOP,
    height: SCALLOP,
    borderRadius: SCALLOP / 2,
    marginTop: -SCALLOP / 2,
  },
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
