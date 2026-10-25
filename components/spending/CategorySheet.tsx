import { useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemedColors, lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { PageSheet } from '@components/shared/PageSheet';
import { DotLeader } from '@components/shared/DotLeader';
import { localizeCategoryName } from '@utils/categoryName';
import { formatDateDDMMYYYY, localizedMonthLabel } from '@utils/dates';
import {
  coverLabel,
  fmtFull,
  fmtWhole,
  type CategoryRowItem,
  type SpendingView,
} from '@components/spending/spendingFormat';
import type { DrillDownItem } from '@stores/spendingStore';
import { mf, ms } from '@utils/responsive';

// The bills sit on a receipt slip, which stays light in dark mode.
const R = lightColors;

interface CategorySheetProps {
  item: CategoryRowItem | null;
  month: string;
  previousMonth: string | undefined;
  view: SpendingView;
  currency: string;
  onClose: () => void;
}

/**
 * One category of the month in a pop-up: what the house spent and your share,
 * the change since last month in pen, and the bills behind it on a receipt.
 */
export function CategorySheet({
  item: openItem,
  month,
  previousMonth,
  view,
  currency,
  onClose,
}: CategorySheetProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();

  const openBill = useCallback(
    (d: DrillDownItem): void => {
      onClose();
      router.push({ pathname: '/(tabs)/bills/[id]', params: { id: d.id } });
    },
    [onClose]
  );

  // Keep showing the last category while the sheet slides away after closing.
  const lastRef = useRef(openItem);
  if (openItem) lastRef.current = openItem;
  const item = openItem ?? lastRef.current;

  const house = view === 'house';
  const amount = item?.cat.amount ?? 0;
  const prev = item?.prevHouseAmount ?? 0;
  const diff = amount - prev;

  return (
    <PageSheet
      visible={openItem !== null}
      eyebrow={localizedMonthLabel(month, i18n.language)}
      title={item ? localizeCategoryName(item.cat.name, t) : ''}
      onClose={onClose}
    >
      {item && (
        <View>
          <View style={styles.numbers}>
            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {house ? t('spending.house_total') : t('spending.your_share')}
              </Text>
              <Text style={[styles.big, heading, { color: c.textPrimary }]}>
                {fmtWhole(amount, currency)}
              </Text>
            </View>
            {house && item.myAmount > 0 && (
              <View>
                <Text style={[styles.label, { color: c.textSecondary }]}>
                  {t('spending.your_share')}
                </Text>
                <Text style={[styles.big, heading, { color: c.primary }]}>
                  {fmtWhole(item.myAmount, currency)}
                </Text>
              </View>
            )}
          </View>
          {prev > 0 && previousMonth && Math.round(diff) !== 0 && (
            <Text style={[styles.change, hand, { color: diff > 0 ? c.danger : c.success }]}>
              {t(diff > 0 ? 'spending.compare_more' : 'spending.compare_less', {
                amount: fmtWhole(Math.abs(diff), currency),
              })}
              {' · '}
              {t('spending.compared_to', {
                month: localizedMonthLabel(previousMonth, i18n.language),
              })}
            </Text>
          )}

          {item.drillDownItems.length > 0 && (
            <View style={[styles.receipt, { backgroundColor: R.receipt }]}>
              {item.drillDownItems.map((d, i) => {
                const line = (
                  <>
                    <View style={styles.lineText}>
                      <Text style={[styles.title, { color: R.receiptInk }]} numberOfLines={1}>
                        {d.title}
                      </Text>
                      <Text style={[styles.date, { color: R.receiptMuted }]}>
                        {formatDateDDMMYYYY(d.date)}
                        {d.coverFrom && d.coverTo
                          ? ` · ${t('spending.covers', {
                              months: coverLabel(d.coverFrom, d.coverTo, i18n.language),
                            })}`
                          : ''}
                      </Text>
                    </View>
                    <DotLeader color={R.receiptRule} />
                    <Text style={[styles.amt, { color: R.receiptInk }]}>
                      {fmtFull(d.amount, currency)}
                    </Text>
                  </>
                );
                const rowStyle = [
                  styles.line,
                  i > 0 && [styles.ruled, { borderTopColor: R.receiptRule }],
                ];
                return d.type === 'bill' ? (
                  <Pressable
                    key={d.id}
                    style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
                    onPress={(): void => openBill(d)}
                    accessibilityRole="link"
                    accessibilityLabel={t('spending.open_bill', {
                      title: d.title,
                      amount: fmtFull(d.amount, currency),
                    })}
                  >
                    {line}
                    <Ionicons name="chevron-forward" size={13} color={R.receiptMuted} />
                  </Pressable>
                ) : (
                  <View key={d.id} style={rowStyle}>
                    {line}
                    <Ionicons name="repeat" size={13} color={R.receiptMuted} />
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </PageSheet>
  );
}

const styles = StyleSheet.create({
  numbers: { flexDirection: 'row', gap: ms(32), marginTop: ms(4) },
  label: { fontSize: mf(13.5), ...font.bold },
  big: { fontSize: mf(30), lineHeight: mf(38), writingDirection: 'ltr' },
  change: { fontSize: mf(20), marginTop: ms(2), writingDirection: 'ltr' },
  receipt: {
    borderRadius: ms(4),
    paddingHorizontal: ms(16),
    paddingVertical: ms(6),
    marginTop: ms(16),
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: ms(6), minHeight: 52 },
  // A thin solid rule: iOS can't dash a single border side.
  ruled: { borderTopWidth: 1 },
  pressed: { opacity: 0.6 },
  lineText: { flexShrink: 1 },
  title: { fontSize: mf(15), ...font.semibold },
  date: { fontSize: mf(12), ...font.medium, marginTop: ms(1) },
  amt: { fontSize: mf(15), ...font.semibold, writingDirection: 'ltr' },
});
