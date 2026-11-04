import { useCallback } from 'react';
import { View, Pressable, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@lib/alert';
import { useRecurringPalette } from '@components/bills/recurring/palette';
import { EmptyState } from '@components/ui';
import { useMemberName } from '@hooks/useMemberName';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import {
  useSettlementPaymentsStore,
  SettlementDeleteNotAllowedError,
} from '@stores/settlementPaymentsStore';
import { formatFull } from '@constants/currencies';
import { formatDateDDMMYYYY } from '@utils/dates';
import type { SettlementPayment } from '@utils/settleUp';
import { SettleSheet } from './SettleSheet';
import { settleStyles as styles } from './settleStyles';

interface SettlePaymentsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Every settle-up payment in the house, newest first. The two people in one can delete it. */
export function SettlePaymentsSheet({
  visible,
  onClose,
}: SettlePaymentsSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const p = useRecurringPalette();
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const payments = useSettlementPaymentsStore((s) => s.payments);
  const deletePayment = useSettlementPaymentsStore((s) => s.deletePayment);
  const memberName = useMemberName();

  const name = useCallback(
    (id: string): string => (id === myId ? t('bills.you_label') : memberName(id)),
    [myId, memberName, t]
  );

  const confirmDelete = useCallback(
    (item: SettlementPayment): void => {
      const money = formatFull(item.amount, currencyCode);
      Alert.alert(
        t('bills.settle_delete_title'),
        t('bills.settle_delete_body', { from: name(item.from), to: name(item.to), money }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: (): void => {
              deletePayment(item.id).catch((err: unknown) => {
                Alert.alert(
                  t('common.error'),
                  err instanceof SettlementDeleteNotAllowedError
                    ? t('bills.settle_delete_not_allowed')
                    : t('bills.settle_delete_failed')
                );
              });
            },
          },
        ]
      );
    },
    [currencyCode, deletePayment, name, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: SettlementPayment }): React.JSX.Element => {
      const canDelete = item.from === myId || item.to === myId;
      const sub = [
        t('bills.settle_paid_on', { date: formatDateDDMMYYYY(item.paidOn) }),
        item.coversUntil
          ? t('bills.settle_covers_until', { date: formatDateDDMMYYYY(item.coversUntil) })
          : null,
        item.note,
      ]
        .filter(Boolean)
        .join(' · ');
      return (
        <View style={[styles.row, styles.listItem, { borderBottomColor: p.border }]}>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={1}>
              {t('bills.settle_paid', { from: name(item.from), to: name(item.to) })}
            </Text>
            <Text style={[styles.rowSub, { color: p.muted }]}>{sub}</Text>
          </View>
          <Text style={[styles.rowAmount, { color: p.text }]}>
            {formatFull(item.amount, currencyCode)}
          </Text>
          {canDelete && (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.dimmed]}
              onPress={() => confirmDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={t('bills.settle_delete_title')}
            >
              <Ionicons name="trash-outline" size={20} color={p.overdueText} />
            </Pressable>
          )}
        </View>
      );
    },
    [myId, p, t, name, currencyCode, confirmDelete]
  );

  return (
    <SettleSheet
      visible={visible}
      eyebrow={t('bills.settle_up')}
      title={t('bills.settle_history_title')}
      onClose={onClose}
    >
      <FlatList
        data={payments}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        ListEmptyComponent={<EmptyState title={t('bills.settle_history_empty')} />}
      />
    </SettleSheet>
  );
}
