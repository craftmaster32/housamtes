import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSettingsStore } from '@stores/settingsStore';
import { useAuthStore } from '@stores/authStore';
import { useMemberName } from '@hooks/useMemberName';
import { useThemedColors } from '@constants/colors';
import { formatFull } from '@constants/currencies';
import { Stamp } from '@components/shared/Stamp';
import { ReceiptLine } from '@components/bills/ExpenseLines';
import { formatDateDDMMYYYY } from '@utils/dates';
import type { SettlementPayment } from '@utils/settleUp';

/** A settle-up payment in the Bills history: "Dana → Maya ₪300 · Paid". */
export function SettlementLine({
  settlement,
}: {
  settlement: SettlementPayment;
}): React.JSX.Element {
  const c = useThemedColors();
  const { t } = useTranslation();
  const currencyCode = useSettingsStore((s) => s.currencyCode);
  const myId = useAuthStore((s) => s.profile?.id ?? '');
  const memberName = useMemberName();
  const name = (id: string): string =>
    id === myId ? t('bills.you_label') : memberName(id).split(' ')[0];
  const title = t('bills.settle_paid', { from: name(settlement.from), to: name(settlement.to) });
  const meta = [
    t('bills.settle_line_meta'),
    settlement.coversUntil
      ? t('bills.settle_covers_until', { date: formatDateDDMMYYYY(settlement.coversUntil) })
      : null,
    settlement.note,
  ]
    .filter(Boolean)
    .join(' · ');
  const amount = formatFull(settlement.amount, currencyCode);
  return (
    <View
      style={{ backgroundColor: c.receipt }}
      accessible
      accessibilityLabel={`${title}, ${amount}. ${meta}`}
    >
      <ReceiptLine
        kind="receipt"
        tint={c.success}
        title={title}
        meta={meta}
        amount={amount}
        stamp={<Stamp color={c.success}>{t('bills.settle_paid_tag')}</Stamp>}
      />
    </View>
  );
}
