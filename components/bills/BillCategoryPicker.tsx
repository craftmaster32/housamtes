import { useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  Pressable,
  ViewStyle,
  TextStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { resolveCategoryIcon, type ExpenseCategory } from '@stores/expenseCategoriesStore';
import { localizeCategoryName } from '@utils/categoryName';
import { DEFAULT_EXPENSE_CATEGORY } from '@utils/expenseCategory';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { mf, ms } from '@utils/responsive';
import { PenCircle } from '@components/shared/PenCircle';

interface BillCategoryPickerProps {
  categories: ExpenseCategory[];
  selected: string; // the category name currently chosen
  onSelect: (name: string) => void;
  // Opens the quick-add-category popup. It stays on the bill form (no
  // navigation), so the in-progress bill is never lost.
  onAddCategory: () => void;
}

export const BillCategoryPicker: React.FC<BillCategoryPickerProps> = ({
  categories,
  selected,
  onSelect,
  onAddCategory,
}) => {
  const C = useThemedColors();
  const { t } = useTranslation();
  const styles = useMemo((): BillCategoryPickerStyles => makeStyles(C), [C]);
  const handFont = useHandFont();

  // Always show the currently-selected category as a chip, even if it was
  // deleted from the managed list or predates it — otherwise the user loses
  // sight of their own selection.
  const items = useMemo<ExpenseCategory[]>((): ExpenseCategory[] => {
    // "Other" — what every new expense starts on — comes first (owner).
    const isOther = (c: ExpenseCategory): boolean =>
      c.name.toLowerCase() === DEFAULT_EXPENSE_CATEGORY.toLowerCase();
    const list = [...categories.filter(isOther), ...categories.filter((c) => !isOther(c))];
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

  // The chosen category can change on its own (it follows the title), so keep
  // it in view even when it sits at the far end of the row.
  const scrollRef = useRef<ScrollView>(null);
  const itemX = useRef(new Map<string, number>());
  useEffect((): void => {
    const x = itemX.current.get(selected);
    if (x !== undefined)
      scrollRef.current?.scrollTo({ x: Math.max(0, x - ms(16)), animated: true });
  }, [selected]);

  return (
    <ScrollView
      ref={scrollRef}
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
            onLayout={(e: LayoutChangeEvent): void => {
              itemX.current.set(cat.name, e.nativeEvent.layout.x);
              if (isSelected) {
                scrollRef.current?.scrollTo({
                  x: Math.max(0, e.nativeEvent.layout.x - ms(16)),
                  animated: false,
                });
              }
            }}
            style={({ pressed }) => [styles.word, pressed && !isSelected && styles.pressed]}
            onPress={(): void => {
              onSelect(cat.name);
            }}
            accessible
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected: isSelected }}
          >
            {/* The chosen category gets circled by hand. */}
            {isSelected && <PenCircle color={C.primary} style={styles.circle} />}
            <Ionicons
              name={resolveCategoryIcon(cat.icon)}
              size={16}
              color={isSelected ? C.primary : C.textSecondary}
            />
            <Text style={[styles.wordText, isSelected && styles.wordTextSelected]}>{label}</Text>
          </Pressable>
        );
      })}
      <Pressable
        style={({ pressed }) => [styles.word, pressed && styles.pressed]}
        onPress={onAddCategory}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('bills.add_category')}
      >
        <Ionicons name="add" size={18} color={C.primary} />
        <Text style={[styles.addText, handFont]}>{t('bills.add_category')}</Text>
      </Pressable>
    </ScrollView>
  );
};

type BillCategoryPickerStyles = {
  categoryScroll: ViewStyle;
  word: ViewStyle;
  circle: ViewStyle;
  wordText: TextStyle;
  wordTextSelected: TextStyle;
  addText: TextStyle;
  pressed: ViewStyle;
};

const makeStyles = (C: ColorTokens): BillCategoryPickerStyles =>
  StyleSheet.create({
    categoryScroll: { gap: ms(6), paddingVertical: ms(2), paddingHorizontal: ms(2) },
    word: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      minHeight: 44,
      paddingHorizontal: ms(12),
    },
    // A pen circle, slightly tilted, drawn around the chosen word.
    circle: {
      position: 'absolute',
      top: ms(5),
      bottom: ms(5),
      left: 0,
      right: 0,
      transform: [{ rotate: '-3deg' }],
    },
    wordText: { color: C.textSecondary, fontSize: mf(15), ...font.bold },
    wordTextSelected: { color: C.textPrimary },
    addText: { color: C.primary, fontSize: mf(21) },
    pressed: { opacity: 0.6 },
  });
