import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useThemedColors, darkColors } from '@constants/colors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useLanguageStore } from '@stores/languageStore';
import { detectCategory, toneColors } from '@utils/groceryCategory';
import { UNIT_OPTS, unitLabel, type GroceryUnit } from '@utils/groceryUnits';
import { makeStyles } from './AddItemSheet.styles';

const QUICK_ADD_KEYS = [
  'grocery.quick_add_milk',
  'grocery.quick_add_bread',
  'grocery.quick_add_trash_bags',
  'grocery.quick_add_coffee',
  'grocery.quick_add_butter',
  'grocery.quick_add_olive_oil',
] as const;

export interface AddItemSheetProps {
  visible: boolean;
  /** Whatever was already typed in the add bar. */
  initialName: string;
  /** One line telling the user where the item will land (shared, private, draft). */
  destinationHint: string;
  /** True when an unticked item with this name is already on the list. */
  isOnList: (name: string) => boolean;
  isAdding: boolean;
  onAdd: (name: string, quantity: string, note: string) => Promise<boolean>;
  onClose: () => void;
}

/** Bottom sheet with the extra details — amount, unit, note — plus quick adds. */
export function AddItemSheet({
  visible,
  initialName,
  destinationHint,
  isOnList,
  isAdding,
  onAdd,
  onClose,
}: AddItemSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const isDark = C.background === darkColors.background;
  const s = useMemo(() => makeStyles(C, isDark), [C, isDark]);
  const headingFont = useHeadingFont('bold');
  const isHebrew = useLanguageStore((st) => st.language) === 'he';

  const [name, setName] = useState(initialName);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<GroceryUnit | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(initialName);
    setQty(1);
    setUnit(null);
    setNote('');
  }, [visible, initialName]);

  const trimmed = name.trim();
  const category = trimmed ? detectCategory(trimmed) : null;
  const tone = category ? toneColors(category.tone, isDark) : null;
  const willMerge = !!trimmed && isOnList(trimmed);

  const changeQty = useCallback((delta: number): void => {
    Haptics.selectionAsync().catch(() => {});
    setQty((prev) => Math.max(1, Math.min(99, prev + delta)));
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!trimmed || isAdding) return;
    const ok = await onAdd(trimmed, `${qty}${unit ?? ''}`, note.trim());
    if (ok) onClose();
  }, [trimmed, isAdding, onAdd, qty, unit, note, onClose]);

  const handleQuickAdd = useCallback(
    async (label: string): Promise<void> => {
      if (isAdding) return;
      Haptics.selectionAsync().catch(() => {});
      await onAdd(label, '1', '');
    },
    [isAdding, onAdd]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.backdrop} onPress={onClose} accessible={false} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={[s.title, headingFont]} accessibilityRole="header">
              {t('grocery.sheet_title')}
            </Text>
            <Pressable
              onPress={onClose}
              style={s.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={20} color={C.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.body}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.field}>
              <Text style={s.label}>{t('grocery.sheet_name_label')}</Text>
              <View style={s.nameBox}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  placeholder={t('grocery.add_bar_placeholder')}
                  placeholderTextColor={C.textTertiary}
                  style={s.nameInput}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  accessibilityLabel={t('grocery.sheet_name_label')}
                  accessibilityHint={t('grocery.add_item_hint')}
                />
                {category && tone && (
                  <View style={[s.catPill, { backgroundColor: tone.bg }]}>
                    <Text style={[s.catPillText, { color: tone.fg }]}>{t(category.labelKey)}</Text>
                  </View>
                )}
              </View>
              {willMerge && <Text style={s.mergeHint}>{t('grocery.sheet_will_merge')}</Text>}
            </View>

            <View style={s.amountRow}>
              <View style={s.field}>
                <Text style={s.label}>{t('grocery.sheet_how_many')}</Text>
                <View style={s.stepper}>
                  <Pressable
                    style={[s.stepBtn, qty <= 1 && s.stepBtnOff]}
                    onPress={() => changeQty(-1)}
                    disabled={qty <= 1}
                    accessibilityRole="button"
                    accessibilityLabel={t('grocery.qty_decrease')}
                    accessibilityState={{ disabled: qty <= 1 }}
                  >
                    <Text style={s.stepSign}>−</Text>
                  </Pressable>
                  <Text style={s.stepValue}>{qty}</Text>
                  <Pressable
                    style={s.stepBtn}
                    onPress={() => changeQty(1)}
                    accessibilityRole="button"
                    accessibilityLabel={t('grocery.qty_increase')}
                  >
                    <Text style={s.stepSign}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={[s.field, s.flex]}>
                <Text style={s.label}>{t('grocery.unit_label')}</Text>
                <View style={s.chips}>
                  {UNIT_OPTS.map((u) => {
                    const active = unit === u;
                    const label = unitLabel(u, isHebrew);
                    return (
                      <Pressable
                        key={u}
                        style={[s.chip, active && s.chipOn]}
                        onPress={() => setUnit(active ? null : u)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={t('grocery.unit_preset', { u: label })}
                      >
                        <Text style={[s.chipText, active && s.chipTextOn]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>
                {t('grocery.sheet_note_label')}{' '}
                <Text style={s.optional}>{t('grocery.sheet_optional')}</Text>
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('grocery.note_placeholder')}
                placeholderTextColor={C.textTertiary}
                style={s.noteInput}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessibilityLabel={t('grocery.note_label')}
                accessibilityHint={t('grocery.note_hint')}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>{t('grocery.quick_add')}</Text>
              <View style={s.chips}>
                {QUICK_ADD_KEYS.map((key) => (
                  <Pressable
                    key={key}
                    style={s.chip}
                    onPress={() => handleQuickAdd(t(key))}
                    accessibilityRole="button"
                    accessibilityLabel={t('grocery.add_quick', { name: t(key) })}
                  >
                    <Text style={s.chipText}>+ {t(key)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          <Text style={s.destination}>{destinationHint}</Text>
          <Pressable
            style={[s.submit, (!trimmed || isAdding) && s.submitOff]}
            onPress={handleSubmit}
            disabled={!trimmed || isAdding}
            accessibilityRole="button"
            accessibilityState={{ disabled: !trimmed || isAdding }}
            accessibilityLabel={
              trimmed ? t('grocery.add_quick', { name: trimmed }) : t('grocery.add_item')
            }
          >
            <Text style={s.submitText}>
              {trimmed ? t('grocery.add_quick', { name: trimmed }) : t('grocery.add_item')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
