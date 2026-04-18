import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useBillsStore, calculateAllNetBalances, settleDebts } from '@stores/billsStore';
import { useRecurringBillsStore, calculateFairness } from '@stores/recurringBillsStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';

export function SettlementPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const sharedBills = useBillsStore((s) => s.bills);
  const householdBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const currency = useSettingsStore((s) => s.currency);

  const sharedNet = calculateAllNetBalances(sharedBills);
  const householdFairness = calculateFairness(householdBills, payments);

  const combinedNet = new Map<string, number>(sharedNet);
  for (const { person, balance } of householdFairness) {
    combinedNet.set(person, (combinedNet.get(person) ?? 0) + balance);
  }

  const allPeople = Array.from(
    new Set([...sharedNet.keys(), ...householdFairness.map((f) => f.person)])
  );

  const breakdown = allPeople.map((person) => ({
    person,
    household: householdFairness.find((f) => f.person === person)?.balance ?? 0,
    shared: sharedNet.get(person) ?? 0,
    total: combinedNet.get(person) ?? 0,
  }));

  const settlements = settleDebts(new Map(combinedNet));
  const hasData = allPeople.length > 0;

  const handleToggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <View style={styles.container}>
      <Pressable style={styles.toggleBtn} onPress={handleToggle} accessibilityRole="button" accessibilityLabel={t('bills.settlement_title')}>
        <Text style={styles.toggleLabel}>{t('bills.settlement_title')}</Text>
        <View style={styles.toggleRight}>
          {settlements.length > 0 && !open && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{settlements.length}</Text>
            </View>
          )}
          <Text style={styles.toggleChevron}>{open ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {open && (
        <View style={styles.panel}>
          {!hasData ? (
            <Text style={styles.emptyText}>{t('bills.settlement_no_expenses')}</Text>
          ) : (
            <>
              {/* Breakdown table */}
              <Text style={styles.sectionTitle}>{t('bills.settlement_breakdown')}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.nameCell, styles.headerText]}>{t('bills.settlement_person')}</Text>
                  <Text style={[styles.amtCell, styles.headerText]}>{t('bills.settlement_house_bills')}</Text>
                  <Text style={[styles.amtCell, styles.headerText]}>{t('bills.settlement_shared')}</Text>
                  <Text style={[styles.amtCell, styles.headerText, styles.totalHeaderText]}>{t('bills.settlement_net')}</Text>
                </View>
                {breakdown.map((row) => (
                  <View key={row.person} style={styles.tableRow}>
                    <Text style={styles.nameCell}>{row.person}</Text>
                    <Text style={[styles.amtCell, { color: row.household >= 0 ? colors.positive : colors.negative }]}>
                      {`${row.household >= 0 ? '+' : ''}${currency}${Math.abs(row.household).toFixed(0)}`}
                    </Text>
                    <Text style={[styles.amtCell, { color: row.shared >= 0 ? colors.positive : colors.negative }]}>
                      {row.shared === 0 ? '—' : `${row.shared >= 0 ? '+' : ''}${currency}${Math.abs(row.shared).toFixed(0)}`}
                    </Text>
                    <Text style={[styles.amtCell, styles.totalCell, { color: row.total >= 0 ? colors.positive : colors.negative }]}>
                      {`${row.total >= 0 ? '+' : ''}${currency}${Math.abs(row.total).toFixed(0)}`}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Settlement transactions */}
              <Text style={styles.sectionTitle}>{t('bills.settlement_to_settle')}</Text>
              {settlements.length === 0 ? (
                <Text style={styles.settledText}>{t('bills.settlement_all_settled')}</Text>
              ) : (
                <View style={styles.settlements}>
                  {settlements.map((s, idx) => (
                    <View key={idx} style={styles.settlementRow}>
                      <View style={styles.settlementPerson}>
                        <Text style={styles.settlementName}>{s.from}</Text>
                        <Text style={styles.settlementRole}>{t('bills.settlement_pays')}</Text>
                      </View>
                      <Text style={styles.settlementArrow}>→</Text>
                      <View style={styles.settlementPerson}>
                        <Text style={styles.settlementName}>{s.to}</Text>
                        <Text style={styles.settlementRole}>{t('bills.settlement_receives')}</Text>
                      </View>
                      <Text style={styles.settlementAmount}>{currency}{s.amount.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sizes.lg,
    paddingVertical: sizes.sm,
  },
  toggleLabel: { fontSize: sizes.fontMd, fontWeight: '700', color: colors.primary },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: sizes.xs },
  badge: {
    backgroundColor: colors.negative,
    borderRadius: sizes.borderRadiusFull,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { fontSize: 11, color: colors.white, fontWeight: '700' },
  toggleChevron: { fontSize: sizes.fontSm, color: colors.textSecondary },

  panel: { paddingHorizontal: sizes.lg, paddingBottom: sizes.md, gap: sizes.md },
  emptyText: { color: colors.textSecondary, fontSize: sizes.fontSm, textAlign: 'center', paddingVertical: sizes.md },
  sectionTitle: {
    fontSize: sizes.fontXs,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Table
  table: { gap: 4 },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: sizes.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRow: { flexDirection: 'row', paddingVertical: 5 },
  headerText: { fontSize: sizes.fontXs, color: colors.textSecondary, fontWeight: '700', textAlign: 'right' },
  totalHeaderText: { fontWeight: '800', color: colors.textPrimary },
  nameCell: { flex: 1, fontSize: sizes.fontSm, color: colors.textPrimary, fontWeight: '600' },
  amtCell: { width: 76, fontSize: sizes.fontSm, textAlign: 'right' },
  totalCell: { fontWeight: '800' },

  // Settlement rows
  settlements: { gap: sizes.sm },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: sizes.borderRadius,
    padding: sizes.md,
    gap: sizes.sm,
  },
  settlementPerson: { flex: 1, alignItems: 'center' },
  settlementName: { fontSize: sizes.fontMd, fontWeight: '700', color: colors.textPrimary },
  settlementRole: { fontSize: sizes.fontXs, color: colors.textSecondary },
  settlementArrow: { fontSize: sizes.fontLg, color: colors.textSecondary },
  settlementAmount: { fontSize: sizes.fontLg, fontWeight: '800', color: colors.textPrimary, minWidth: 72, textAlign: 'right' },
  settledText: { color: colors.positive, fontWeight: '700', fontSize: sizes.fontMd, textAlign: 'center', paddingVertical: sizes.sm },
});
