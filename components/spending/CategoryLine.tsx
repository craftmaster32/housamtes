import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { localizeCategoryName } from '@utils/categoryName';
import { fmtFull, pctChange, type CategoryRowItem } from '@components/spending/spendingFormat';
import { mf, ms } from '@utils/responsive';

interface CategoryLineProps {
  item: CategoryRowItem;
  currency: string;
  expanded: boolean;
  onToggle: (name: string) => void;
}

/**
 * One category of the month: its amount, the change in pen, a highlighter
 * stroke for its share of the section, and the bills inside when opened.
 */
function CategoryLineComponent({
  item,
  currency,
  expanded,
  onToggle,
}: CategoryLineProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const { cat, myAmount, prevHouseAmount, sectionTotal, drillDownItems } = item;
  const pct = pctChange(cat.amount, prevHouseAmount);
  const up = pct !== null && pct > 0;
  const share = sectionTotal > 0 ? Math.round((cat.amount / sectionTotal) * 100) : 0;
  const canExpand = drillDownItems.length > 0;
  const name = localizeCategoryName(cat.name, t);

  const handlePress = useCallback((): void => {
    if (canExpand) onToggle(cat.name);
  }, [canExpand, onToggle, cat.name]);

  return (
    <Pressable
      style={styles.row}
      onPress={canExpand ? handlePress : undefined}
      accessibilityRole={canExpand ? 'button' : 'none'}
      accessibilityLabel={`${name}, ${fmtFull(cat.amount, currency)}${canExpand ? `, ${t('spending.tap_details')}` : ''}`}
      accessibilityState={canExpand ? { expanded } : undefined}
    >
      <View style={styles.top}>
        <Ionicons name={cat.icon} size={18} color={cat.color} />
        <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
          {name}
        </Text>
        {pct !== null && (
          <Text style={[styles.pct, hand, { color: up ? c.negative : c.positive }]}>
            {up ? '↑' : '↓'}
            {Math.abs(pct)}%
          </Text>
        )}
        <Text style={[styles.amt, { color: c.textPrimary }]}>{fmtFull(cat.amount, currency)}</Text>
        {canExpand && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={c.textSecondary}
          />
        )}
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${share}%` as `${number}%`, backgroundColor: cat.color }]}
        />
      </View>
      {myAmount > 0 && (
        <Text style={[styles.mine, hand, { color: c.textSecondary }]}>
          {t('spending.your_share')}: {fmtFull(myAmount, currency)}
        </Text>
      )}
      {expanded && (
        <View style={[styles.drill, { borderStartColor: c.border }]}>
          {drillDownItems.map((d) =>
            d.type === 'bill' ? (
              <Link
                key={d.id}
                href={{ pathname: '/(tabs)/bills/[id]', params: { id: d.id } }}
                asChild
              >
                <Pressable
                  style={styles.drillRow}
                  accessibilityRole="link"
                  accessibilityLabel={t('spending.open_bill', {
                    title: d.title,
                    amount: fmtFull(d.amount, currency),
                  })}
                >
                  <Text style={[styles.drillTitle, { color: c.textPrimary }]} numberOfLines={1}>
                    {d.title}
                  </Text>
                  <Text style={[styles.drillAmt, { color: c.textSecondary }]}>
                    {fmtFull(d.amount, currency)}
                  </Text>
                  <Ionicons
                    name={rtl ? 'chevron-back' : 'chevron-forward'}
                    size={12}
                    color={c.textSecondary}
                  />
                </Pressable>
              </Link>
            ) : (
              <View key={d.id} style={styles.drillRow}>
                <Ionicons name="repeat" size={12} color={c.textSecondary} />
                <Text style={[styles.drillTitle, { color: c.textPrimary }]} numberOfLines={1}>
                  {d.title}
                </Text>
                <Text style={[styles.drillAmt, { color: c.textSecondary }]}>
                  {fmtFull(d.amount, currency)}
                </Text>
              </View>
            )
          )}
        </View>
      )}
    </Pressable>
  );
}

export const CategoryLine = React.memo(CategoryLineComponent);

const styles = StyleSheet.create({
  row: { paddingVertical: ms(10) },
  top: { flexDirection: 'row', alignItems: 'center', gap: ms(8), minHeight: 28 },
  name: { flex: 1, minWidth: 0, fontSize: mf(15), ...font.semibold },
  pct: { fontSize: mf(16) },
  amt: { fontSize: mf(15), ...font.semibold },
  track: { height: ms(6), marginTop: ms(6), marginStart: ms(26) },
  fill: { height: '100%', borderRadius: ms(3), opacity: 0.45 },
  mine: { fontSize: mf(16), lineHeight: mf(19), marginTop: ms(3), marginStart: ms(26) },
  drill: { marginTop: ms(6), marginStart: ms(26), borderStartWidth: 2, paddingStart: ms(10) },
  drillRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), minHeight: 40 },
  drillTitle: { flex: 1, minWidth: 0, fontSize: mf(14), ...font.regular },
  drillAmt: { fontSize: mf(14), ...font.medium },
});
