// app/(tabs)/bills/[id].tsx
// Bill detail — v2 redesign.
// Same data flow as v1. New: dark theme via useThemedColors, `type` ladder,
// `Header` UI primitive, animated press scale on action buttons, fade-up
// entrance, `useExpandable` on the edit form.

import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { DatePickerModal } from '@components/bills/DatePickerModal';
import { useBillsStore, getPersonShare, CATEGORIES } from '@stores/billsStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useBadgeStore } from '@stores/badgeStore';
import { resolveName } from '@utils/housemates';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Button, EmptyState, Pill, Header } from '@components/ui';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useFadeInUp, usePressScale, useCountUp } from '@utils/animations';

const CATEGORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  rent: 'home-outline',
  groceries: 'cart-outline',
  food: 'fast-food-outline',
  transport: 'car-outline',
  utilities: 'flash-outline',
  internet: 'wifi-outline',
  phone: 'phone-portrait-outline',
  entertainment: 'musical-notes-outline',
  health: 'medkit-outline',
  shopping: 'bag-outline',
  travel: 'airplane-outline',
  other: 'receipt-outline',
};

function formatDisplayDate(iso: string, locale: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return d.toLocaleDateString(locale || undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BillDetailScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const bill = useBillsStore((s) => s.bills.find((b) => b.id === id));
  const isLoading   = useBillsStore((s) => s.isLoading);
  const editBill    = useBillsStore((s) => s.editBill);
  const settleBill  = useBillsStore((s) => s.settleBill);
  const deleteBill  = useBillsStore((s) => s.deleteBill);
  const profile     = useAuthStore((s) => s.profile);
  const houseId     = useAuthStore((s) => s.houseId);
  const role        = useAuthStore((s) => s.role);
  const canDelete   = role === 'owner' || role === 'admin';
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const housemates   = useHousematesStore((s) => s.housemates);
  const markSeen     = useBadgeStore((s) => s.markSeen);

  useFocusEffect(useCallback(() => { markSeen('bills').catch(() => {}); }, [markSeen]));

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle]   = useState(bill?.title ?? '');
  const [amount, setAmount] = useState(bill?.amount.toString() ?? '');
  const [date, setDate]     = useState(bill?.date ?? '');
  const [notes, setNotes]   = useState(bill?.notes ?? '');
  const [category, setCategory] = useState(bill?.category ?? 'Other');

  // Sync form back to bill data when not editing (covers async load + cancel)
  useEffect(() => {
    if (!isEditing && bill) {
      setTitle(bill.title);
      setAmount(bill.amount.toString());
      setDate(bill.date);
      setNotes(bill.notes ?? '');
      setCategory(bill.category ?? 'Other');
    }
  }, [bill, isEditing]);

  const [isSaving, setIsSaving]   = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [error, setError]         = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const openDatePicker  = useCallback((): void => setShowDatePicker(true), []);
  const closeDatePicker = useCallback((): void => setShowDatePicker(false), []);

  // Page fade-up on mount.
  const fadeStyle = useFadeInUp(0);

  // Count-up the prominent amount.
  const displayAmount = useCountUp(bill?.amount ?? 0, {
    formatter: (n) => formatFull(n, currencyCode),
    duration: 700,
    skipOnMount: false,
  });

  const handleSaveEdit = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!title.trim()) { setError(t('bills.title_required')); return; }
    if (isNaN(parsed) || parsed <= 0) { setError(t('bills.enter_valid_amount')); return; }
    if (!bill) return;
    try {
      setIsSaving(true);
      await editBill(bill.id, { title: title.trim(), amount: parsed, date, notes, category });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bills.failed_save'));
    } finally {
      setIsSaving(false);
    }
  }, [bill, title, amount, date, notes, category, editBill, t]);

  const handleSettle = useCallback(async () => {
    if (!bill || !profile || !houseId) return;
    try {
      setIsSettling(true);
      await settleBill(bill.id, profile.id, profile.name, houseId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bills.failed_settle'));
    } finally {
      setIsSettling(false);
    }
  }, [bill, profile, houseId, settleBill, t]);

  const handleDelete = useCallback((): void => {
    if (!bill) return;
    Alert.alert(
      t('bills.delete_confirm_title'),
      t('bills.delete_confirm_message', { title: bill.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('bills.delete_bill'), style: 'destructive',
          onPress: async (): Promise<void> => {
            try {
              await deleteBill(bill.id, houseId ?? '');
              router.replace('/(tabs)/bills');
            } catch (err) {
              setError(err instanceof Error ? err.message : t('bills.failed_delete'));
            }
          },
        },
      ],
    );
  }, [bill, houseId, deleteBill, t]);

  if (!bill) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header title="Bill" back />
        <View style={styles.centered}>
          <EmptyState
            mode={isLoading ? 'loading' : 'empty'}
            icon="receipt-outline"
            title={isLoading ? 'Loading…' : t('bills.bill_not_found')}
            actionLabel={isLoading ? undefined : t('bills.back_to_bills')}
            onAction={isLoading ? undefined : (): void => { router.replace('/(tabs)/bills'); }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isCustomSplit = !!bill.splitAmounts;
  const icon = CATEGORY_ICONS[(bill.category ?? '').toLowerCase()] ?? 'receipt-outline';

  const editRight = !bill.settled && !isEditing ? (
    <Pressable
      onPress={() => setIsEditing(true)}
      style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('common.edit')}
      accessibilityHint={t('common.edit_hint')}
      accessibilityState={{ disabled: false }}
    >
      <Text style={[type.label, { color: C.primary }]}>{t('common.edit')}</Text>
    </Pressable>
  ) : isEditing ? (
    <Pressable
      onPress={() => { setIsEditing(false); setError(''); }}
      style={{ minWidth: 44, minHeight: 44, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('common.cancel')}
      accessibilityHint={t('common.cancel_hint')}
      accessibilityState={{ disabled: false }}
    >
      <Text style={[type.label, { color: C.textSecondary }]}>{t('common.cancel')}</Text>
    </Pressable>
  ) : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title={isEditing ? t('bills.edit_bill') : 'Bill'} back right={editRight} />
      <Animated.View style={[styles.flex, fadeStyle]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Status banner */}
          {bill.settled && (
            <Pill tone="success" size="md" icon="checkmark-circle-outline">
              {t('bills.settled_by_on', {
                name: bill.settledBy ? resolveName(bill.settledBy, housemates) : '',
                date: bill.settledAt ? new Date(bill.settledAt).toLocaleDateString() : '',
              })}
            </Pill>
          )}

          {/* Hero card — title + count-up amount, with category icon */}
          {!isEditing && (
            <View style={styles.heroCard}>
              <View style={styles.heroDeco} />
              <View style={styles.heroHeader}>
                <View style={[styles.heroIcon, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
                  <Ionicons name={icon} size={20} color="#fff" />
                </View>
                <Text style={[type.eyebrow, { color: 'rgba(255,255,255,0.78)' }]}>{bill.category ?? 'Other'}</Text>
              </View>
              <Text style={[type.title, { color: '#fff' }]}>{bill.title}</Text>
              <Text style={[type.displayLg, { color: '#fff', letterSpacing: -0.8 }]}>{displayAmount}</Text>
            </View>
          )}

          {/* Detail / Edit form */}
          {isEditing ? (
            <View style={styles.card}>
              <TextInput
                label={t('bills.title_label')}
                value={title}
                onChangeText={(v) => { setTitle(v); setError(''); }}
                mode="outlined"
                style={styles.input}
                outlineColor={C.border}
                activeOutlineColor={C.primary}
                accessibilityLabel={t('bills.title_label')}
                accessibilityHint={t('bills.title_hint')}
              />
              <TextInput
                label={t('bills.amount_label')}
                value={amount}
                onChangeText={(v) => { setAmount(v); setError(''); }}
                mode="outlined"
                style={styles.input}
                keyboardType="decimal-pad"
                outlineColor={C.border}
                activeOutlineColor={C.primary}
                accessibilityLabel={t('bills.amount_label')}
                accessibilityHint={t('bills.amount_hint')}
              />
              <View style={styles.dateField}>
                <Text style={[type.captionMed, { color: C.textSecondary, marginLeft: 4 }]}>{t('bills.date_label')}</Text>
                <Pressable
                  style={[styles.dateTrigger, { backgroundColor: C.surface, borderColor: C.border }]}
                  onPress={openDatePicker}
                  accessibilityRole="button"
                  accessibilityLabel={t('bills.pick_date')}
                  accessibilityState={{ expanded: showDatePicker }}
                >
                  <Ionicons name="calendar-outline" size={18} color={C.primary} />
                  <Text style={[type.bodyMd, { color: C.textPrimary, flex: 1 }]}>{formatDisplayDate(date, i18n.language)}</Text>
                  <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
                </Pressable>
              </View>
              <TextInput
                label={t('bills.notes_label')}
                value={notes}
                onChangeText={setNotes}
                mode="outlined"
                style={styles.input}
                placeholder={t('bills.notes_placeholder')}
                multiline
                numberOfLines={2}
                outlineColor={C.border}
                activeOutlineColor={C.primary}
                accessibilityLabel={t('bills.notes_label')}
                accessibilityHint={t('bills.notes_hint')}
              />
              <View style={styles.categoryField}>
                <Text style={[type.captionMed, { color: C.textSecondary, marginLeft: 4 }]}>{t('bills.category')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
                  {CATEGORIES.map((cat) => {
                    const icon = CATEGORY_ICONS[cat.toLowerCase()] ?? 'receipt-outline';
                    const selected = category === cat;
                    return (
                      <CategoryChip
                        key={cat}
                        icon={icon}
                        selected={selected}
                        onPress={() => setCategory(cat)}
                        label={t(`bills.cat_${cat.toLowerCase()}`)}
                        C={C}
                      />
                    );
                  })}
                </ScrollView>
              </View>
              {!!error && <Text style={[type.bodySm, { color: C.danger }]}>{error}</Text>}
              <Button variant="primary" onPress={handleSaveEdit} loading={isSaving} disabled={isSaving} fullWidth>
                {t('common.save')}
              </Button>
            </View>
          ) : (
            <View style={styles.card}>
              <MetaRow label={t('bills.date')} value={new Date(bill.date).toLocaleDateString()} C={C} />
              <MetaRow label={t('bills.paid_by')} value={resolveName(bill.paidBy, housemates)} C={C} />
              {bill.notes ? (
                <MetaRow label={t('bills.notes_label')} value={bill.notes} multiline C={C} />
              ) : null}
            </View>
          )}

          {/* Split breakdown */}
          {!isEditing && (
            <View style={styles.card}>
              <Text style={[type.label, { color: C.textPrimary, marginBottom: 6 }]}>{t('bills.split_breakdown')}</Text>
              <Text style={[type.bodySm, { color: C.textSecondary, marginBottom: 8 }]}>
                {t('bills.total')} {formatFull(bill.amount, currencyCode)} · {isCustomSplit ? t('bills.custom_split') : `${t('bills.equal_split')} ${bill.splitBetween.length}`}
              </Text>
              {bill.splitBetween.map((person) => (
                <View key={person} style={styles.splitRow}>
                  <View style={[styles.splitDot, { backgroundColor: C.primary }]} />
                  <Text style={[type.bodyMdMed, { color: C.textPrimary, flex: 1 }]}>{resolveName(person, housemates)}</Text>
                  <Text style={[type.amount, { color: C.primary }]}>{formatFull(getPersonShare(bill, person), currencyCode)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Actions */}
          {!isEditing && !bill.settled && (
            <Button
              variant="primary"
              onPress={handleSettle}
              loading={isSettling}
              disabled={isSettling}
              fullWidth
              size="lg"
              haptic="success"
              style={{ backgroundColor: C.positive }}
            >
              {t('bills.mark_settled')}
            </Button>
          )}

          {!isEditing && canDelete && (
            <Button
              variant="danger"
              onPress={handleDelete}
              fullWidth
              size="lg"
              haptic="warn"
            >
              {t('bills.delete_bill')}
            </Button>
          )}

          {!!error && !isEditing && <Text style={[type.bodySm, { color: C.danger, textAlign: 'center' }]}>{error}</Text>}
        </ScrollView>
      </Animated.View>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        onSelect={setDate}
        onClose={closeDatePicker}
      />
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetaRow({ label, value, multiline, C }: { label: string; value: string; multiline?: boolean; C: ColorTokens }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 4, gap: 12 }}>
      <Text style={[type.bodyMd, { color: C.textSecondary }]}>{label}</Text>
      <Text
        style={[type.bodyMdMed, { color: C.textPrimary, flexShrink: 1, textAlign: 'right' }]}
        selectable={multiline}
      >
        {value}
      </Text>
    </View>
  );
}

function CategoryChip({
  icon, selected, onPress, label, C,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
  label: string;
  C: ColorTokens;
}): React.JSX.Element {
  const press = usePressScale(0.93);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        style={[
          {
            flexDirection: 'row', alignItems: 'center', gap: 5,
            paddingVertical: 10, paddingHorizontal: 12, minHeight: 44,
            borderRadius: 9999, borderWidth: 1.5,
            borderColor: selected ? C.primary : C.primary + '55',
            backgroundColor: selected ? C.primary : C.primary + '08',
          },
        ]}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Ionicons name={icon} size={15} color={selected ? '#fff' : C.primary} />
        <Text style={[type.labelSm, { color: selected ? '#fff' : C.primary }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  const isDark = C.background !== '#F6F2EA';
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    flex:      { flex: 1 },
    content:   { padding: sizes.lg, gap: sizes.md, paddingBottom: sizes.xxl },
    centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sizes.md },

    heroCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      padding: sizes.lg, gap: 10,
      position: 'relative', overflow: 'hidden',
    },
    heroDeco: {
      position: 'absolute', top: -40, right: -30, width: 160, height: 160,
      borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)',
    },
    heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroIcon:   { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

    card: {
      backgroundColor: C.surface,
      borderRadius: sizes.borderRadiusLg,
      padding: sizes.lg, gap: sizes.sm,
      ...(isDark
        ? { borderWidth: StyleSheet.hairlineWidth, borderColor: C.border }
        : { boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }),
    } as never,

    splitRow: {
      flexDirection: 'row', alignItems: 'center', gap: sizes.sm, paddingVertical: 6,
    },
    splitDot: { width: 8, height: 8, borderRadius: 4 },

    input: { backgroundColor: C.surface },
    dateField: { gap: 4 },
    dateTrigger: {
      flexDirection: 'row', alignItems: 'center', gap: sizes.sm,
      borderRadius: 8, borderWidth: 1,
      paddingHorizontal: 14, paddingVertical: 14, minHeight: 56,
    },

    categoryField: { gap: 4 },
    categoryScroll: { gap: sizes.xs, paddingVertical: 2 },
  });
}
