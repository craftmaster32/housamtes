import React, { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguageStore } from '@stores/languageStore';
import { isRTL } from '@lib/i18n';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { DotLeader } from '@components/shared/DotLeader';
import { localizeCategoryName } from '@utils/categoryName';
import { fmtFull, fmtWhole, type CategoryRowItem } from '@components/spending/spendingFormat';
import { mf, ms } from '@utils/responsive';

interface CategoryRowProps {
  item: CategoryRowItem;
  currency: string;
  onOpen: (item: CategoryRowItem) => void;
}

/**
 * One line of "Where it went": colour dot, name, a dotted leader and the
 * amount. Tapping it opens the category's details in a pop-up.
 */
function CategoryRowComponent({ item, currency, onOpen }: CategoryRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const rtl = isRTL(useLanguageStore((s) => s.language));
  const name = localizeCategoryName(item.cat.name, t);

  const handlePress = useCallback((): void => onOpen(item), [onOpen, item]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: c.border },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${fmtFull(item.cat.amount, currency)}`}
      accessibilityHint={t('spending.tap_details')}
    >
      <View style={[styles.dot, { backgroundColor: item.cat.color }]} />
      <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
        {name}
      </Text>
      <DotLeader color={c.textTertiary} />
      <Text style={[styles.amt, { color: c.textPrimary }]}>
        {fmtWhole(item.cat.amount, currency)}
      </Text>
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={15} color={c.textSecondary} />
    </Pressable>
  );
}

export const CategoryRow = React.memo(CategoryRowComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    minHeight: 48,
    borderBottomWidth: 1.5,
  },
  pressed: { opacity: 0.6 },
  dot: { width: ms(10), height: ms(10), borderRadius: ms(5) },
  name: { flexShrink: 1, fontSize: mf(16), ...font.semibold },
  // Money stays LTR so ₪ and the digits don't reorder in Hebrew.
  amt: { fontSize: mf(16), ...font.semibold, writingDirection: 'ltr' },
});
