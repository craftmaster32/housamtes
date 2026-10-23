import { useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { lightColors, useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { useLanguageStore } from '@stores/languageStore';
import { PenCircle } from '@components/shared/PenCircle';
import { UNIT_OPTS, unitLabel, type GroceryUnit } from '@utils/groceryUnits';
import { mf, ms } from '@utils/responsive';

interface AmountUnitPickerProps {
  qty: number;
  unit: GroceryUnit | null;
  onQtyChange: (qty: number) => void;
  onUnitChange: (unit: GroceryUnit | null) => void;
  /** On cream paper the inks stay light-theme; on the page they follow the theme. */
  onPaper?: boolean;
}

/**
 * How many (− n +, the number handwritten in blue) and the unit as words to
 * circle in pen: × (pieces) · ml · L · g · kg.
 */
export function AmountUnitPicker({
  qty,
  unit,
  onQtyChange,
  onUnitChange,
  onPaper = false,
}: AmountUnitPickerProps): React.JSX.Element {
  const { t } = useTranslation();
  const theme = useThemedColors();
  const c = onPaper ? lightColors : theme;
  const hand = useHandFont();
  const isHebrew = useLanguageStore((s) => s.language) === 'he';
  const ink = onPaper ? c.paperInk : c.textPrimary;
  const muted = onPaper ? c.paperMuted : c.textSecondary;

  const step = useCallback(
    (d: number): void => {
      Haptics.selectionAsync().catch(() => {});
      onQtyChange(Math.max(1, Math.min(99, qty + d)));
    },
    [qty, onQtyChange]
  );

  const units: (GroceryUnit | null)[] = [null, ...UNIT_OPTS];
  const stepBg = onPaper ? 'rgba(107,98,80,0.14)' : theme.surface;

  return (
    <View style={styles.row}>
      <View style={styles.amount}>
        <Pressable
          onPress={() => step(-1)}
          disabled={qty <= 1}
          style={[styles.step, qty <= 1 && styles.dim]}
          accessibilityRole="button"
          accessibilityLabel={t('grocery.qty_decrease')}
          accessibilityState={{ disabled: qty <= 1 }}
        >
          <Text style={[styles.sign, { color: ink, backgroundColor: stepBg }]}>−</Text>
        </Pressable>
        <Text
          style={[styles.qty, hand, { color: c.primary }]}
          accessibilityLabel={`${t('grocery.quantity')} ${qty}`}
        >
          {qty}
        </Text>
        <Pressable
          onPress={() => step(1)}
          style={styles.step}
          accessibilityRole="button"
          accessibilityLabel={t('grocery.qty_increase')}
        >
          <Text style={[styles.sign, { color: ink, backgroundColor: stepBg }]}>+</Text>
        </Pressable>
      </View>
      <View style={styles.units} accessibilityRole="radiogroup">
        {units.map((u) => {
          const on = unit === u;
          const label = u ? unitLabel(u, isHebrew) : '×';
          return (
            <Pressable
              key={u ?? 'pieces'}
              onPress={() => onUnitChange(u)}
              style={styles.unit}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={
                u ? t('grocery.unit_preset', { u: label }) : t('grocery.quantity')
              }
            >
              {on && <PenCircle color={c.primary} style={styles.circle} />}
              <Text style={[styles.unitText, { color: on ? ink : muted }, on && styles.unitOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { flexDirection: 'row', alignItems: 'center', gap: ms(2) },
  step: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  sign: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: mf(16),
    ...font.semibold,
  },
  dim: { opacity: 0.4 },
  qty: { fontSize: mf(25), minWidth: ms(18), textAlign: 'center' },
  units: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  unit: {
    minHeight: 44,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(5),
  },
  circle: {
    position: 'absolute',
    top: ms(8),
    bottom: ms(8),
    left: 0,
    right: 0,
    transform: [{ rotate: '-6deg' }],
  },
  unitText: { fontSize: mf(14.5), ...font.medium },
  unitOn: { ...font.bold },
});
