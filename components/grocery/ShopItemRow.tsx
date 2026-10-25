import { memo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { type GroceryItem } from '@stores/groceryStore';
import { useLanguageStore } from '@stores/languageStore';
import { lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { detectCategory } from '@utils/groceryCategory';
import { localizeQuantityForDisplay } from '@utils/groceryUnits';
import { mf, ms } from '@utils/responsive';

// Rows sit on the paper bag (light in both themes).
const INK = lightColors.kraftInk;
const MUTED = lightColors.kraftMuted;
const PEN = lightColors.primary;

interface ShopItemRowProps {
  item: GroceryItem;
  onToggle: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onSetCount: (id: string, count: number) => void;
}

/** One thing to grab, as a big row on the bag: ink box, name, aisle · amount · note. */
export const ShopItemRow = memo(function ShopItemRow({
  item,
  onToggle,
  onIncrement,
  onDecrement,
  onSetCount,
}: ShopItemRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const hand = useHandFont();
  const isHebrew = useLanguageStore((st) => st.language) === 'he';

  // Items with a plain count > 1 (e.g. "3") get a +/- stepper so you can buy
  // part of them and leave the rest on the list. Everything else is a simple
  // bought / not-bought tick.
  const isPlainInt = /^\d+$/.test(item.quantity.trim());
  const qtyNum = isPlainInt ? parseInt(item.quantity, 10) : NaN;
  const hasCount = isPlainInt && qtyNum > 1;
  const bought = item.boughtCount ?? 0;
  const done = hasCount ? bought >= qtyNum : item.isChecked;
  // "Dairy · the barista one" — aisle first so you can shop in order.
  const subLine = [
    item.isPersonal ? t('grocery.my_items') : t(detectCategory(item.name).labelKey),
    item.comment ? `“${item.comment}”` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const amount =
    !hasCount && item.quantity && item.quantity !== '1'
      ? localizeQuantityForDisplay(item.quantity, isHebrew)
      : null;

  const box = (
    <View style={styles.box}>
      {done && (
        <Svg width={ms(29)} height={ms(29)} viewBox="0 0 26 26" style={styles.tick}>
          <Path
            d="M4 13 L10.5 20 L23 3"
            stroke={PEN}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      )}
    </View>
  );

  return (
    <Pressable
      style={styles.row}
      onPress={hasCount ? undefined : (): void => onToggle(item.id)}
      // For counted rows the row itself isn't tappable (the box and stepper
      // are), so don't expose it as an actionable checkbox to assistive tech.
      accessible={!hasCount}
      accessibilityRole={hasCount ? undefined : 'checkbox'}
      accessibilityState={hasCount ? undefined : { checked: done }}
      accessibilityLabel={
        hasCount ? undefined : [item.name, amount, subLine].filter(Boolean).join(', ')
      }
    >
      {hasCount ? (
        // Tapping the box jumps the whole quantity to bought (or clears it),
        // so you don't have to tap + for every unit.
        <Pressable
          onPress={(): void => onSetCount(item.id, done ? 0 : qtyNum)}
          hitSlop={10}
          accessible
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={t('grocery.shop.mark_all_bought', { name: item.name })}
        >
          {box}
        </Pressable>
      ) : (
        box
      )}
      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, done && styles.nameDone]} numberOfLines={2}>
            {item.name}
          </Text>
          {!!amount && <Text style={[styles.amount, hand]}>{amount}</Text>}
        </View>
        {!!subLine && (
          <Text style={styles.sub} numberOfLines={1}>
            {subLine}
          </Text>
        )}
      </View>
      {hasCount && (
        <View style={styles.counter}>
          <Pressable
            onPress={() => onDecrement(item.id)}
            style={[styles.ctrBtn, bought === 0 && styles.off]}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.decrease_item', { name: item.name })}
            accessibilityState={{ disabled: bought === 0 }}
          >
            <Text style={styles.ctrSign}>−</Text>
          </Pressable>
          <Text style={[styles.ctrText, hand]}>
            {bought}/{qtyNum}
          </Text>
          <Pressable
            onPress={() => onIncrement(item.id)}
            style={[styles.ctrBtn, styles.ctrPlus, bought >= qtyNum && styles.off]}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.increase_item', { name: item.name })}
            accessibilityState={{ disabled: bought >= qtyNum }}
          >
            <Text style={[styles.ctrSign, styles.ctrSignPlus]}>+</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(14),
    minHeight: 60,
    paddingVertical: ms(8),
  },
  box: {
    width: ms(26),
    height: ms(26),
    borderWidth: 2.4,
    borderColor: INK,
    borderRadius: ms(5),
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: 0, top: -ms(11) },
  copy: { flex: 1, minWidth: 0, gap: ms(2) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: ms(6), flexWrap: 'wrap' },
  name: { fontSize: mf(17.5), ...font.semibold, color: INK, flexShrink: 1 },
  nameDone: { color: MUTED, textDecorationLine: 'line-through' },
  amount: { fontSize: mf(21), color: PEN, writingDirection: 'ltr' },
  sub: { fontSize: mf(13), ...font.regular, color: MUTED },
  counter: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
  ctrBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.8,
    borderColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrPlus: { backgroundColor: PEN, borderColor: PEN },
  off: { opacity: 0.35 },
  ctrSign: { fontSize: mf(18), ...font.semibold, color: INK, lineHeight: mf(20) },
  ctrSignPlus: { color: '#FFFFFF' },
  // A fixed slot (and same-width digits) so going from 9/12 to 10/12 never
  // widens the counter and re-wraps the name beside it.
  ctrText: {
    fontSize: mf(22),
    color: INK,
    width: ms(48),
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
