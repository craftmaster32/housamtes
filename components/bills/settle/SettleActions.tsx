import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@stores/authStore';
import { useSettlementPaymentsStore } from '@stores/settlementPaymentsStore';
import { useThemedColors } from '@constants/colors';
import { useHandFont } from '@hooks/useHandFont';
import { font } from '@constants/typography';
import { mf, ms } from '@utils/responsive';
import type { Transfer } from '@utils/settleUp';

interface SettleActionsProps {
  /** The house's current settle-up plan (fewest transfers). */
  plan: Transfer[];
  /** Open "Settle up to a date". */
  onUpTo: () => void;
}

/**
 * Under the settle-up lines: "Settle up to a date" (for "everything until the
 * end of September was paid outside the app"), and a warning if the recorded
 * payments couldn't load. Each line has its own "Settle" button.
 */
export function SettleActions({ plan, onUpTo }: SettleActionsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const c = useThemedColors();
  const handFont = useHandFont();
  const houseId = useAuthStore((s) => s.houseId) ?? '';
  const loadError = useSettlementPaymentsStore((s) => s.error);
  const reload = useSettlementPaymentsStore((s) => s.load);

  const retry = useCallback((): void => {
    if (houseId) void reload(houseId);
  }, [houseId, reload]);

  if (!loadError && plan.length === 0) return null;

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
      {plan.length > 0 && (
        // A handwritten note on the page, like "+ Add recurring bill" (DESIGN.md).
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={onUpTo}
          accessibilityRole="button"
          accessibilityLabel={t('bills.settle_upto_btn')}
        >
          <Ionicons name="calendar-outline" size={18} color={c.primary} />
          <Text style={[styles.actionText, handFont, { color: c.primary }]} numberOfLines={1}>
            {t('bills.settle_upto_btn')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: ms(12), gap: ms(8), alignItems: 'flex-start' },
  action: { flexDirection: 'row', alignItems: 'center', gap: ms(6), minHeight: 44 },
  actionText: { fontSize: mf(22) },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), minHeight: 44 },
  errorText: { fontSize: mf(14), ...font.semibold, flex: 1 },
  pressed: { opacity: 0.7 },
});
