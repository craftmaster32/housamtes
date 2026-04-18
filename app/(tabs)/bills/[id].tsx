import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useBillsStore, getPersonShare } from '@stores/billsStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';

export default function BillDetailScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBillsStore((s) => s.bills.find((b) => b.id === id));
  const editBill = useBillsStore((s) => s.editBill);
  const settleBill = useBillsStore((s) => s.settleBill);
  const deleteBill = useBillsStore((s) => s.deleteBill);
  const profile = useAuthStore((s) => s.profile);
  const currency = useSettingsStore((s) => s.currency);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(bill?.title ?? '');
  const [amount, setAmount] = useState(bill?.amount.toString() ?? '');
  const [date, setDate] = useState(bill?.date ?? '');
  const [notes, setNotes] = useState(bill?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [error, setError] = useState('');

  const handleSaveEdit = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!title.trim()) { setError(t('bills.title_required')); return; }
    if (isNaN(parsed) || parsed <= 0) { setError(t('bills.enter_valid_amount')); return; }
    if (!bill) return;
    try {
      setIsSaving(true);
      await editBill(bill.id, { title: title.trim(), amount: parsed, date, notes });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bills.failed_save'));
    } finally {
      setIsSaving(false);
    }
  }, [bill, title, amount, date, notes, editBill, t]);

  const handleSettle = useCallback(async () => {
    if (!bill || !profile) return;
    try {
      setIsSettling(true);
      await settleBill(bill.id, profile.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bills.failed_settle'));
    } finally {
      setIsSettling(false);
    }
  }, [bill, profile, settleBill, t]);

  const handleDelete = useCallback(async () => {
    if (!bill) return;
    await deleteBill(bill.id);
    router.replace('/(tabs)/bills');
  }, [bill, deleteBill]);

  if (!bill) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('bills.bill_not_found')}</Text>
          <Pressable onPress={() => router.replace('/(tabs)/bills')}>
            <Text style={styles.linkText}>{t('bills.back_to_bills')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isCustomSplit = !!bill.splitAmounts;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← {t('common.back')}</Text>
          </Pressable>
          {!bill.settled && !isEditing && (
            <Pressable onPress={() => setIsEditing(true)}>
              <Text style={styles.editText}>{t('common.edit')}</Text>
            </Pressable>
          )}
        </View>

        {/* Status banner */}
        {bill.settled && (
          <View style={styles.settledBanner}>
            <Text style={styles.settledBannerText}>
              ✓ {t('bills.settled_by_on', {
                name: bill.settledBy,
                date: bill.settledAt ? new Date(bill.settledAt).toLocaleDateString() : '',
              })}
            </Text>
          </View>
        )}

        {/* Detail / Edit form */}
        {isEditing ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('bills.edit_bill')}</Text>
            <TextInput
              label={t('bills.title_label')}
              value={title}
              onChangeText={(v) => { setTitle(v); setError(''); }}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label={t('bills.amount_label')}
              value={amount}
              onChangeText={(v) => { setAmount(v); setError(''); }}
              mode="outlined"
              style={styles.input}
              keyboardType="decimal-pad"
            />
            <TextInput
              label={t('bills.date_label')}
              value={date}
              onChangeText={setDate}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label={t('bills.notes_label')}
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              style={styles.input}
              placeholder={t('bills.notes_placeholder')}
              multiline
              numberOfLines={2}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.editButtons}>
              <Button mode="contained" onPress={handleSaveEdit} loading={isSaving} disabled={isSaving} style={styles.saveBtn}>
                {t('common.save')}
              </Button>
              <Button mode="text" onPress={() => { setIsEditing(false); setError(''); }}>{t('common.cancel')}</Button>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.billTitle}>{bill.title}</Text>
            <Text style={styles.billAmount}>{currency}{bill.amount.toFixed(2)}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('bills.category')}</Text>
              <Text style={styles.metaValue}>{bill.category}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('bills.date')}</Text>
              <Text style={styles.metaValue}>{new Date(bill.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{t('bills.paid_by')}</Text>
              <Text style={styles.metaValue}>{bill.paidBy}</Text>
            </View>
            {bill.notes ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{t('bills.notes_label')}</Text>
                <Text style={styles.metaValue} selectable>{bill.notes}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Split breakdown */}
        {!isEditing && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('bills.split_breakdown')}</Text>
            <Text style={styles.splitTotal}>
              {t('bills.total')} {currency}{bill.amount.toFixed(2)} · {isCustomSplit ? t('bills.custom_split') : `${t('bills.equal_split')} ${bill.splitBetween.length}`}
            </Text>
            {bill.splitBetween.map((person) => (
              <View key={person} style={styles.splitRow}>
                <View style={styles.splitDot} />
                <Text style={styles.splitPerson}>{person}</Text>
                <Text style={styles.splitAmount}>{currency}{getPersonShare(bill, person).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {!isEditing && !bill.settled && (
          <Button
            mode="contained"
            onPress={handleSettle}
            loading={isSettling}
            disabled={isSettling}
            style={styles.settleBtn}
            contentStyle={{ height: 52 }}
            buttonColor={colors.positive}
          >
            {t('bills.mark_settled')}
          </Button>
        )}

        {!isEditing && (
          <Button
            mode="outlined"
            onPress={handleDelete}
            style={styles.deleteBtn}
            contentStyle={{ height: 52 }}
            textColor={colors.danger}
          >
            {t('bills.delete_bill')}
          </Button>
        )}

        {!!error && !isEditing && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: sizes.lg, gap: sizes.md, paddingBottom: sizes.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sizes.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sizes.xs },
  backBtn: { padding: 4 },
  backText: { color: colors.primary, fontSize: 15, ...font.medium },
  editText: { color: colors.primary, fontSize: 15, ...font.medium },
  settledBanner: {
    backgroundColor: colors.positive + '20',
    borderRadius: 12,
    padding: sizes.sm,
    alignItems: 'center',
  },
  settledBannerText: { color: colors.positive, ...font.semibold, fontSize: 14 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: sizes.lg,
    gap: sizes.sm,
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  } as never,
  billTitle: { fontSize: 22, ...font.bold, color: colors.textPrimary, letterSpacing: -0.3 },
  billAmount: { fontSize: 34, ...font.extrabold, color: colors.primary, letterSpacing: -1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 2 },
  metaLabel: { color: colors.textSecondary, fontSize: 14, ...font.regular },
  metaValue: { color: colors.textPrimary, fontSize: 14, ...font.semibold, flexShrink: 1, textAlign: 'right' },
  sectionTitle: { color: colors.textPrimary, ...font.bold, fontSize: 15, marginBottom: sizes.xs },
  splitTotal: { color: colors.textSecondary, fontSize: 14, ...font.regular },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm, paddingVertical: 4 },
  splitDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  splitPerson: { flex: 1, color: colors.textPrimary, fontSize: 15, ...font.medium },
  splitAmount: { color: colors.primary, fontSize: 15, ...font.semibold },
  input: { backgroundColor: colors.white },
  editButtons: { flexDirection: 'row', gap: sizes.sm, alignItems: 'center', marginTop: sizes.xs },
  saveBtn: { borderRadius: 14 },
  settleBtn: { borderRadius: 14 },
  deleteBtn: { borderRadius: 14, borderColor: colors.danger },
  error: { color: colors.danger, fontSize: sizes.fontSm, ...font.regular },
  emptyText: { color: colors.textSecondary, fontSize: 15, ...font.regular },
  linkText: { color: colors.primary, fontSize: 15, ...font.medium },
});
