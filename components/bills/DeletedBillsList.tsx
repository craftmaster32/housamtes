import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { useMemberName } from '@hooks/useMemberName';
import { useThemedColors } from '@constants/colors';
import { sizes } from '@constants/sizes';
import { font } from '@constants/typography';
import type { HistoryItem } from '@utils/recurringHistory';
import { ms } from '@utils/responsive';

interface DeletedBillsListProps {
  items: HistoryItem[]; // bill deletions, newest first
  currency: string;
}

/** Recently deleted recurring bills, with who deleted each one and when. */
export function DeletedBillsList({ items, currency }: DeletedBillsListProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const memberName = useMemberName();

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.title, { color: c.textSecondary }]}>
        {t('bills.history_deleted_bills')}
      </Text>
      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={[styles.name, { color: c.textPrimary }]}>
            {item.bill?.name ?? ''}
            {item.bill
              ? ` · ~${currency}${item.bill.typicalAmount.toFixed(0)} · ${t(`bills.freq_${item.bill.frequency}`)}`
              : ''}
          </Text>
          <Text style={[styles.meta, { color: c.textSecondary }]}>
            {t('bills.history_deleted_by', {
              name: item.actorId ? memberName(item.actorId) : t('bills.history_someone'),
              date: format(parseISO(item.at), 'dd/MM/yyyy HH:mm'),
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: sizes.borderRadius, borderWidth: 1, padding: sizes.md, gap: sizes.sm },
  title: {
    fontSize: sizes.fontXs,
    ...font.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  item: { gap: ms(2) },
  name: { fontSize: sizes.fontSm, ...font.semibold },
  meta: { fontSize: sizes.fontXs },
});
