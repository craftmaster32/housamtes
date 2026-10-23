import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CATEGORY_META } from '@stores/spendingStore';
import { useSettingsStore } from '@stores/settingsStore';
import type { Bill } from '@stores/billsStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

interface RecentActivityProps {
  today: Bill[];
  yesterday: Bill[];
  userName: string;
  onMore: () => void;
}

/** Bills from today and yesterday with your share of each. */
export function RecentActivity({
  today,
  yesterday,
  userName,
  onMore,
}: RecentActivityProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const currency = useSettingsStore((s) => s.currency);

  const row = (bill: Bill): React.JSX.Element => {
    const splits = bill.splitBetween.length || 1;
    const share = bill.splitAmounts
      ? (bill.splitAmounts[userName] ?? bill.amount / splits)
      : bill.amount / splits;
    const meta = CATEGORY_META[bill.category?.toLowerCase() ?? ''] ?? CATEGORY_META['other'];
    return (
      <View key={bill.id} style={styles.activity}>
        <Ionicons name={meta.icon} size={17} color={meta.color} />
        <View style={styles.activityText}>
          <Text style={[styles.activityTitle, { color: c.textPrimary }]} numberOfLines={1}>
            {bill.title}
          </Text>
          <Text style={[styles.activitySub, hand, { color: c.textSecondary }]}>
            {bill.paidBy === userName
              ? t('profile.paid_by_you')
              : t('profile.paid_by_name', { name: bill.paidBy })}
          </Text>
        </View>
        <View style={styles.activityAmt}>
          <Text style={[styles.amt, { color: c.textPrimary }]}>
            -{currency}
            {share.toFixed(2)}
          </Text>
          <Text style={[styles.amtSub, { color: c.textSecondary }]}>{t('profile.your_share')}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      {today.length > 0 && (
        <>
          <Text style={[styles.day, { color: c.textSecondary }]}>{t('profile.today_label')}</Text>
          {today.map(row)}
        </>
      )}
      {yesterday.length > 0 && (
        <>
          <Text style={[styles.day, { color: c.textSecondary }]}>
            {t('profile.yesterday_label')}
          </Text>
          {yesterday.map(row)}
        </>
      )}
      <Pressable style={styles.more} onPress={onMore} accessibilityRole="button">
        <Text style={[styles.moreText, { color: c.primary }]}>
          {t('profile.view_previous_months')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: ms(18), paddingHorizontal: ms(16), paddingVertical: ms(6) },
  day: { fontSize: mf(12.5), ...font.bold, marginTop: ms(8) },
  activity: { flexDirection: 'row', alignItems: 'center', gap: ms(10), paddingVertical: ms(8) },
  activityText: { flex: 1, minWidth: 0 },
  activityTitle: { fontSize: mf(15), ...font.semibold },
  activitySub: { fontSize: mf(16), lineHeight: mf(19) },
  activityAmt: { alignItems: 'flex-end' },
  amt: { fontSize: mf(15), ...font.semibold },
  amtSub: { fontSize: mf(11.5), ...font.regular },
  more: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  moreText: { fontSize: mf(14), ...font.semibold },
});
