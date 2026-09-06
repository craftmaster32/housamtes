import { useMemo } from 'react';
import { StyleSheet, ScrollView, Pressable, ViewStyle, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { resolveCategoryIcon, type ExpenseCategory } from '@stores/expenseCategoriesStore';
import { localizeCategoryName } from '@utils/categoryName';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { mf, ms } from '@utils/responsive';

interface BillCategoryPickerProps {
  categories: ExpenseCategory[];
  selected: string; // the category name currently chosen
  onSelect: (name: string) => void;
  // Fired just before navigating to the category manager, so the screen can flag
  // that the in-progress form must be kept when the user returns.
  onManage: () => void;
}

export const BillCategoryPicker: React.FC<BillCategoryPickerProps> = ({
  categories,
  selected,
  onSelect,
  onManage,
}) => {
  const C = useThemedColors();
  const { t } = useTranslation();
  const styles = useMemo((): BillCategoryPickerStyles => makeStyles(C), [C]);

  // Always show the currently-selected category as a chip, even if it was
  // deleted from the managed list or predates it — otherwise the user loses
  // sight of their own selection.
  const items = useMemo<ExpenseCategory[]>((): ExpenseCategory[] => {
    const list = [...categories];
    if (selected && !list.some((c) => c.name === selected)) {
      list.unshift({
        id: `__current_${selected}`,
        name: selected,
        icon: '',
        color: C.primary,
        isDefault: false,
        sortOrder: -1,
      });
    }
    return list;
  }, [categories, selected, C.primary]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoryScroll}
    >
      {items.map((cat): React.JSX.Element => {
        const isSelected = selected === cat.name;
        const label = localizeCategoryName(cat.name, t);
        return (
          <Pressable
            key={cat.id}
            style={[styles.catChip, isSelected && styles.catChipSelected]}
            onPress={(): void => { onSelect(cat.name); }}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected: isSelected }}
          >
            <Ionicons
              name={resolveCategoryIcon(cat.icon)}
              size={15}
              color={isSelected ? C.white : C.primary}
            />
            <Text style={[styles.catChipText, isSelected && styles.catChipTextSelected]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
      <Link href="/(tabs)/settings/categories" onPress={onManage} asChild>
        <Pressable
          style={styles.catChipAdd}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('bills.add_category')}
        >
          <Ionicons name="add" size={15} color={C.primary} />
          <Text style={styles.catChipAddText}>{t('bills.add_category')}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
};

type BillCategoryPickerStyles = {
  categoryScroll: ViewStyle;
  catChip: ViewStyle;
  catChipSelected: ViewStyle;
  catChipText: TextStyle;
  catChipTextSelected: TextStyle;
  catChipAdd: ViewStyle;
  catChipAddText: TextStyle;
};

const makeStyles = (C: ColorTokens): BillCategoryPickerStyles =>
  StyleSheet.create({
    categoryScroll: { gap: sizes.xs, paddingVertical: ms(2) },
    catChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(5),
      paddingVertical: ms(10),
      paddingHorizontal: ms(12),
      minHeight: ms(44),
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderColor: C.primary + '55',
      backgroundColor: C.primary + '08',
    },
    catChipSelected: { backgroundColor: C.primary, borderColor: C.primary },
    catChipText: { color: C.primary, fontSize: mf(13), ...font.semibold },
    catChipTextSelected: { color: C.white },
    catChipAdd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(5),
      paddingVertical: ms(10),
      paddingHorizontal: ms(12),
      minHeight: ms(44),
      borderRadius: sizes.borderRadiusFull,
      borderWidth: 1.5,
      borderStyle: 'dashed' as const,
      borderColor: C.primary + '55',
      backgroundColor: 'transparent',
    },
    catChipAddText: { color: C.primary, fontSize: mf(13), ...font.semibold },
  });
