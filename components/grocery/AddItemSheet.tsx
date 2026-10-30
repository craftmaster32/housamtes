import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHandFont } from '@hooks/useHandFont';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { AmountUnitPicker } from '@components/grocery/AmountUnitPicker';
import { detectCategory, toneColors } from '@utils/groceryCategory';
import { type GroceryUnit } from '@utils/groceryUnits';
import { mf, ms } from '@utils/responsive';

const QUICK_ADD_KEYS = [
  'grocery.quick_add_milk',
  'grocery.quick_add_bread',
  'grocery.quick_add_trash_bags',
  'grocery.quick_add_coffee',
  'grocery.quick_add_butter',
  'grocery.quick_add_olive_oil',
] as const;

export type AddDestination = 'shared' | 'private' | 'draft';

export interface AddItemSheetProps {
  visible: boolean;
  /** Whatever was already typed in the add bar. */
  initialName: string;
  destination: AddDestination;
  /** Drafts are behind a house setting; hide that option when it's off. */
  draftEnabled: boolean;
  onSelectDestination: (dest: AddDestination) => void;
  /** True when an unticked item with this name is already on the list. */
  isOnList: (name: string) => boolean;
  isAdding: boolean;
  onAdd: (name: string, quantity: string, note: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Bottom sheet with the extra details, written on lines: the item, how many and
 * the unit (circled in pen), a note for whoever shops, who it's for, and quick
 * adds as little paper tags.
 */
export function AddItemSheet({
  visible,
  initialName,
  destination,
  draftEnabled,
  onSelectDestination,
  isOnList,
  isAdding,
  onAdd,
  onClose,
}: AddItemSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const hand = useHandFont();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';

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
  const tone = category ? toneColors(category.tone, false) : null;
  const willMerge = !!trimmed && isOnList(trimmed);

  const destWords = useMemo<ChoiceWord<AddDestination>[]>(
    () => [
      { value: 'shared', label: t('grocery.sheet_for_everyone') },
      { value: 'private', label: t('grocery.personal_seg') },
      ...(draftEnabled ? [{ value: 'draft' as const, label: t('grocery.draft_seg') }] : []),
    ],
    [t, draftEnabled]
  );
  const destHint =
    destination === 'private'
      ? t('grocery.personal_hint')
      : destination === 'draft'
        ? t('grocery.sheet_draft_sub')
        : t('grocery.shared_hint');

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!trimmed || isAdding) return;
    const ok = await onAdd(trimmed, `${qty}${unit ?? ''}`, note.trim());
    if (ok) onClose();
  }, [trimmed, isAdding, onAdd, qty, unit, note, onClose]);

  const handleQuickAdd = useCallback(
    async (label: string): Promise<void> => {
      if (isAdding) return;
      await onAdd(label, '1', '');
    },
    [isAdding, onAdd]
  );

  const submitLabel = trimmed ? t('grocery.add_quick', { name: trimmed }) : t('grocery.add_item');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('nav.grocery')}
            title={t('grocery.sheet_title')}
            onClose={onClose}
          />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <View>
              <UnderlineInput
                label={t('grocery.sheet_name_label')}
                value={name}
                onChangeText={setName}
                placeholder={t('grocery.add_bar_placeholder')}
                accessibilityLabel={t('grocery.sheet_name_label')}
                accessibilityHint={t('grocery.add_item_hint')}
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
              />
              <View style={styles.underName}>
                {category && tone && (
                  // Which aisle it'll hang under, as a little sign.
                  <View style={[styles.aisle, { backgroundColor: tone.bg }]}>
                    <Ionicons name={category.icon} size={13} color={tone.fg} />
                    <Text style={[styles.aisleText, { color: tone.fg }]}>
                      {t(category.labelKey)}
                    </Text>
                  </View>
                )}
                {willMerge && (
                  <Text style={[styles.merge, hand, { color: c.negative }]}>
                    {t('grocery.sheet_will_merge')}
                  </Text>
                )}
              </View>
            </View>

            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {t('grocery.sheet_how_many')}
              </Text>
              <AmountUnitPicker qty={qty} unit={unit} onQtyChange={setQty} onUnitChange={setUnit} />
            </View>

            <UnderlineInput
              label={`${t('grocery.sheet_note_label')} ${t('grocery.sheet_optional')}`}
              value={note}
              onChangeText={setNote}
              placeholder={t('grocery.note_placeholder')}
              accessibilityLabel={t('grocery.note_label')}
              accessibilityHint={t('grocery.note_hint')}
            />

            <View>
              <Text style={[styles.label, { color: c.textSecondary }]}>
                {t('grocery.sheet_who_for')}
              </Text>
              <ChoiceWords
                options={destWords}
                selected={destination}
                onSelect={onSelectDestination}
                groupLabel={t('grocery.sheet_who_for')}
              />
              <Text style={[styles.hint, { color: c.textSecondary }]}>{destHint}</Text>
            </View>

            {!trimmed && (
              <View>
                <Text style={[styles.label, { color: c.textSecondary }]}>
                  {t('grocery.quick_add')}
                </Text>
                <View style={styles.tags}>
                  {QUICK_ADD_KEYS.map((key) => (
                    <PaperTag
                      key={key}
                      label={t(key)}
                      onPress={() => void handleQuickAdd(t(key))}
                    />
                  ))}
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: c.primary },
                (!trimmed || isAdding || pressed) && styles.dim,
              ]}
              onPress={() => void handleSubmit()}
              disabled={!trimmed || isAdding}
              accessibilityRole="button"
              accessibilityState={{ disabled: !trimmed || isAdding }}
              accessibilityLabel={submitLabel}
            >
              <Text style={styles.submitText} numberOfLines={1}>
                {submitLabel}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '92%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  body: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(36), gap: ms(18) },
  underName: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: ms(10),
    marginTop: ms(8),
  },
  aisle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(5),
    paddingHorizontal: ms(9),
    paddingVertical: ms(4),
    borderRadius: ms(6),
    transform: [{ rotate: '-1.5deg' }],
  },
  aisleText: { fontSize: mf(12.5), ...font.bold },
  merge: { fontSize: mf(17), flexShrink: 1 },
  label: { fontSize: mf(13.5), ...font.bold, marginBottom: ms(2) },
  hint: { fontSize: mf(13), ...font.regular, marginTop: ms(2) },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(10), marginTop: ms(6) },
  submit: {
    minHeight: 52,
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
  },
  submitText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
