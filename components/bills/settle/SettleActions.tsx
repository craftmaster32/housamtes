import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import type { Transfer } from '@utils/settleUp';
import type { IoniconName } from '@/types/icons';
import { RecordPaymentSheet } from './RecordPaymentSheet';
import { SettleUpToDateSheet } from './SettleUpToDateSheet';
import { SettlePaymentsSheet } from './SettlePaymentsSheet';

interface SettleActionsProps {
  /** The house's current settle-up plan (fewest transfers). */
  plan: Transfer[];
}

type SheetKind = 'record' | 'upto' | 'history' | null;

interface ActionProps {
  icon: IoniconName;
  label: string;
  onPress: () => void;
}

function Action({ icon, label, onPress }: ActionProps): React.JSX.Element {
  const c = useThemedColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.action,
        { borderColor: c.paperMuted },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={c.paperInk} />
      <Text style={[styles.actionText, { color: c.paperInk }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Buttons under the balance: record a payment, settle up to a date, payment history. */
export function SettleActions({ plan }: SettleActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const housemates = useHousematesStore((s) => s.housemates);
  const paymentCount = useSettlementPaymentsStore((s) => s.payments.length);
  const loadError = useSettlementPaymentsStore((s) => s.error);
  const reload = useSettlementPaymentsStore((s) => s.load);
  const [open, setOpen] = useState<SheetKind>(null);

  const people = useMemo(
    () =>
      [
        profile ? { id: profile.id, name: profile.name ?? '' } : null,
        ...housemates.map((h) => ({ id: h.id, name: h.name })),
      ]
        .filter((p): p is { id: string; name: string } => Boolean(p?.id && p?.name))
        .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i),
    [profile, housemates]
  );

  const close = useCallback((): void => setOpen(null), []);
  const openRecord = useCallback((): void => setOpen('record'), []);
  const openUpTo = useCallback((): void => setOpen('upto'), []);
  const openHistory = useCallback((): void => setOpen('history'), []);
  const retry = useCallback((): void => {
    if (houseId) void reload(houseId);
  }, [houseId, reload]);

  // Settling up needs someone to settle with.
  if (people.length < 2) return null;

  return (
    <View style={styles.wrap}>
      {loadError ? (
        <Pressable
          onPress={retry}
          style={styles.errorRow}
          accessibilityRole="button"
          accessibilityLabel={t('bills.settle_load_error')}
          accessibilityHint={t('bills.retry')}
        >
          <Ionicons name="alert-circle-outline" size={16} color={c.danger} />
          <Text style={[styles.errorText, { color: c.danger }]}>
            {t('bills.settle_load_error')}
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.row}>
        {/* Nothing owed = nothing to settle; new spending is added as a bill. */}
        {plan.length > 0 && (
          <Action icon="cash-outline" label={t('bills.settle_record_btn')} onPress={openRecord} />
        )}
        {plan.length > 0 && (
          <Action icon="calendar-outline" label={t('bills.settle_upto_btn')} onPress={openUpTo} />
        )}
        {paymentCount > 0 && (
          <Action
            icon="time-outline"
            label={t('bills.settle_history_btn', { count: paymentCount })}
            onPress={openHistory}
          />
        )}
      </View>

      <RecordPaymentSheet visible={open === 'record'} people={people} plan={plan} onClose={close} />
      <SettleUpToDateSheet visible={open === 'upto'} onClose={close} />
      <SettlePaymentsSheet visible={open === 'history'} onClose={close} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: ms(12), gap: ms(8) },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    minHeight: 44,
    paddingHorizontal: ms(12),
    borderRadius: 22,
    borderWidth: 1,
  },
  actionText: { fontSize: mf(14), ...font.bold },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), minHeight: 44 },
  errorText: { fontSize: mf(14), ...font.semibold, flex: 1 },
  pressed: { opacity: 0.7 },
});
