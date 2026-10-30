import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { resolveCategoryIcon, type ExpenseCategory } from '@stores/expenseCategoriesStore';
import { localizeCategoryName } from '@utils/categoryName';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';

interface CategoryRowProps {
  cat: ExpenseCategory;
  last: boolean;
  onEdit: (cat: ExpenseCategory) => void;
  onDelete: (cat: ExpenseCategory) => void;
}

/** One category on a ruled line: its icon in its colour, Edit in blue, Delete in red. */
function CategoryRowComponent({
  cat,
  last,
  onEdit,
  onDelete,
}: CategoryRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  return (
    <View style={[styles.row, !last && { borderBottomColor: c.border, ...styles.ruled }]}>
      <Ionicons name={resolveCategoryIcon(cat.icon)} size={19} color={cat.color} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
          {localizeCategoryName(cat.name, t)}
        </Text>
        {cat.isDefault && (
          <Text style={[styles.default, hand, { color: c.textSecondary }]}>
            {t('categories.default')}
          </Text>
        )}
      </View>
      <Pressable onPress={() => onEdit(cat)} style={styles.link} accessibilityRole="button">
        <Text style={[styles.linkText, { color: c.primary }]}>{t('categories.edit')}</Text>
      </Pressable>
      <Pressable onPress={() => onDelete(cat)} style={styles.link} accessibilityRole="button">
        <Text style={[styles.linkText, { color: c.negative }]}>{t('categories.delete')}</Text>
      </Pressable>
    </View>
  );
}

export const CategoryRow = React.memo(CategoryRowComponent);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: ms(10), minHeight: 56 },
  ruled: { borderBottomWidth: 1 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: mf(15.5), ...font.semibold },
  default: { fontSize: mf(16), lineHeight: mf(18) },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: ms(6) },
  linkText: { fontSize: mf(14), ...font.semibold },
});
