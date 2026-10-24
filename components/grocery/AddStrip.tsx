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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { type GroceryUnit } from '@utils/groceryUnits';
import { AmountUnitPicker } from '@components/grocery/AmountUnitPicker';
import { mf, ms } from '@utils/responsive';

// The strip is paper, so its inks don't follow the theme.
const INK = lightColors.paperInk;
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

      <AmountUnitPicker qty={qty} unit={unit} onQtyChange={setQty} onUnitChange={setUnit} onPaper />
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
});
