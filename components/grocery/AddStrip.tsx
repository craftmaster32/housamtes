import { useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useThemedColors, lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { useLanguageStore } from '@stores/languageStore';
import { PenCircle } from '@components/shared/PenCircle';
import { UNIT_OPTS, unitLabel, type GroceryUnit } from '@utils/groceryUnits';
import { mf, ms } from '@utils/responsive';

// The strip is paper, so its inks don't follow the theme.
const INK = lightColors.paperInk;
const MUTED = lightColors.paperMuted;
const PEN = lightColors.primary;
// The browser draws its own focus box around inputs; the dashed line is enough.
const DASHES = Array.from({ length: 50 });
const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as ViewStyle;

interface AddStripProps {
  value: string;
  onChangeText: (v: string) => void;
  inputRef: React.RefObject<TextInput | null>;
  isAdding: boolean;
  /** Adds the typed item with "<count><unit>"; resolves true when it went in. */
  onAdd: (quantity: string) => Promise<boolean>;
  /** Long-press on + : the sheet with a note and the other details. */
  onOpenDetails: () => void;
}

/**
 * Adding to the list, on a cream paper strip: write the item on the dashed
 * line, set how many and the unit (circled in pen), then the round blue +.
 * Amount and unit go back to ×1 after each item.
 */
export function AddStrip({
  value,
  onChangeText,
  inputRef,
  isAdding,
  onAdd,
  onOpenDetails,
}: AddStripProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const isHebrew = useLanguageStore((s) => s.language) === 'he';
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<GroceryUnit | null>(null);

  const handleAdd = useCallback(async (): Promise<void> => {
    if (!value.trim()) {
      onOpenDetails();
      return;
    }
    if (await onAdd(`${qty}${unit ?? ''}`)) {
      setQty(1);
      setUnit(null);
    }
  }, [value, qty, unit, onAdd, onOpenDetails]);

  const step = useCallback((d: number): void => {
    Haptics.selectionAsync().catch(() => {});
    setQty((q) => Math.max(1, Math.min(99, q + d)));
  }, []);

  const units: (GroceryUnit | null)[] = [null, ...UNIT_OPTS];

  return (
    <View style={[styles.strip, { backgroundColor: c.paper }]}>
      <View style={styles.line1}>
        <View style={styles.field}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={t('grocery.add_bar_placeholder')}
            placeholderTextColor="#9A917E"
            style={[styles.input, noWebOutline]}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={() => {
              handleAdd().catch(() => {});
            }}
            accessibilityLabel={t('grocery.add_item_a11y')}
            accessibilityHint={t('grocery.add_item_hint')}
          />
          {/* iOS can't dash a single border side, so the line is drawn as dashes. */}
          <View style={styles.dashes} pointerEvents="none">
            {DASHES.map((_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>
        </View>
        <Pressable
          onPress={() => {
            handleAdd().catch(() => {});
          }}
          onLongPress={onOpenDetails}
          delayLongPress={400}
          disabled={isAdding}
          style={({ pressed }) => [
            styles.plus,
            { backgroundColor: c.primary },
            (pressed || isAdding) && styles.dim,
          ]}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: isAdding }}
          accessibilityLabel={t('grocery.add_item')}
          accessibilityHint={t('grocery.add_more_details')}
          accessibilityActions={[{ name: 'longpress', label: t('grocery.add_more_details') }]}
          onAccessibilityAction={onOpenDetails}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={28} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      <View style={styles.line2}>
        <View style={styles.amount}>
          <Pressable
            onPress={() => step(-1)}
            disabled={qty <= 1}
            style={[styles.step, qty <= 1 && styles.dim]}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.qty_decrease')}
            accessibilityState={{ disabled: qty <= 1 }}
          >
            <Text style={styles.stepSign}>−</Text>
          </Pressable>
          <Text style={[styles.qty, hand]} accessibilityLabel={`${t('grocery.quantity')} ${qty}`}>
            {qty}
          </Text>
          <Pressable
            onPress={() => step(1)}
            style={styles.step}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.qty_increase')}
          >
            <Text style={styles.stepSign}>+</Text>
          </Pressable>
        </View>
        <View style={styles.units} accessibilityRole="radiogroup">
          {units.map((u) => {
            const on = unit === u;
            const label = u ? unitLabel(u, isHebrew) : '×';
            return (
              <Pressable
                key={u ?? 'pieces'}
                onPress={() => setUnit(u)}
                style={styles.unit}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={
                  u ? t('grocery.unit_preset', { u: label }) : t('grocery.quantity')
                }
              >
                {on && <PenCircle color={PEN} style={styles.circle} />}
                <Text style={[styles.unitText, on && styles.unitOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginTop: ms(14),
    borderRadius: ms(18),
    paddingTop: ms(8),
    paddingBottom: ms(4),
    paddingStart: ms(16),
    paddingEnd: ms(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(6) },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  line1: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
  field: { flex: 1, minWidth: 0 },
  input: { fontSize: mf(16.5), ...font.semibold, color: INK, paddingVertical: ms(8) },
  dashes: { flexDirection: 'row', gap: ms(4), height: 2, overflow: 'hidden' },
  dash: { width: ms(6), height: 2, backgroundColor: 'rgba(107,98,80,0.35)' },
  plus: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 0,
    elevation: 2,
  },
  dim: { opacity: 0.5 },
  line2: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { flexDirection: 'row', alignItems: 'center', gap: ms(2) },
  step: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepSign: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center',
    lineHeight: 28,
    fontSize: mf(16),
    ...font.semibold,
    color: '#4A463F',
    backgroundColor: 'rgba(107,98,80,0.14)',
  },
  qty: { fontSize: mf(25), color: PEN, minWidth: ms(18), textAlign: 'center' },
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
  unitText: { fontSize: mf(14.5), ...font.medium, color: MUTED },
  unitOn: { ...font.bold, color: INK },
});
