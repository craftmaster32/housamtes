import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  type ViewStyle,
  type TextInput as RNTextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { type SavedListItem } from '@stores/groceryStore';
import { useThemedColors, darkColors, lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { UnderlineInput } from '@components/bills/form/UnderlineInput';

import { mf, ms } from '@utils/responsive';
import { PenTick } from '@components/shared/PenTick';

export type ListEditorMode = 'create' | 'edit';

interface GroceryListEditorModalProps {
  visible: boolean;
  mode: ListEditorMode;
  initialName?: string;
  initialIsPrivate?: boolean;
  initialItems?: SavedListItem[];
  onSubmit: (name: string, isPrivate: boolean, items: SavedListItem[]) => Promise<void>;
  onClose: () => void;
}

export function GroceryListEditorModal({
  visible,
  mode,
  initialName = '',
  initialIsPrivate = false,
  initialItems = [],
  onSubmit,
  onClose,
}: GroceryListEditorModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const headingFont = useHeadingFont('semibold');
  const itemInputRef = useRef<RNTextInput>(null);

  const [listName, setListName] = useState(initialName);
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [items, setItems] = useState<SavedListItem[]>(initialItems);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form each time the modal opens so it reflects the list being
  // created/edited and never carries stale state from a previous open.
  useEffect(() => {
    if (visible) {
      setListName(initialName);
      setIsPrivate(initialIsPrivate);
      setItems(initialItems);
      setItemName('');
      setItemQty('');
      setError(null);
    }
    // Only re-seed on open; the initial* props are a snapshot taken at that time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleAddItem = useCallback((): void => {
    const name = itemName.trim();
    if (!name) return;
    setItems((prev) => [...prev, { name, quantity: itemQty.trim() }]);
    setItemName('');
    setItemQty('');
    setError(null);
    setTimeout(() => itemInputRef.current?.focus(), 50);
  }, [itemName, itemQty]);

  const handleRemoveItem = useCallback((index: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    const name = listName.trim();
    if (!name || isSaving) return;
    // Fold any half-typed item the user forgot to add so it isn't lost on save.
    const pending = itemName.trim();
    const finalItems = pending ? [...items, { name: pending, quantity: itemQty.trim() }] : items;
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(name, isPrivate, finalItems);
      onClose();
    } catch {
      setError(t('grocery.could_not_save_list'));
    } finally {
      setIsSaving(false);
    }
  }, [listName, isSaving, itemName, itemQty, items, isPrivate, onSubmit, onClose, t]);

  const handleCancel = useCallback((): void => {
    if (isSaving) return;
    onClose();
  }, [isSaving, onClose]);

  const handleListNameChange = useCallback((v: string): void => {
    setListName(v);
    setError(null);
  }, []);

  const hand = useHandFont();
  const overlay = C === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const title = mode === 'create' ? t('grocery.new_list') : t('grocery.edit_list');
  const canSave = !!listName.trim() && !isSaving;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleCancel}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: C.background }]} accessibilityViewIsModal>
          <SheetHeader eyebrow={t('grocery.saved_lists')} title={title} onClose={handleCancel} />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <UnderlineInput
              label={t('grocery.list_name')}
              value={listName}
              onChangeText={handleListNameChange}
              placeholder={t('grocery.list_name_placeholder')}
              accessibilityLabel={t('grocery.list_name')}
              accessibilityHint={t('grocery.list_name_hint')}
            />

            {/* The list itself, written on an index card. */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, headingFont]} numberOfLines={1}>
                  {listName.trim() || title}
                </Text>
              </View>
              {items.length === 0 && (
                <Text style={styles.emptyItems}>{t('grocery.no_items_yet')}</Text>
              )}
              {items.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.cardRow}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!!item.quantity && <Text style={[styles.itemQty, hand]}>{item.quantity}</Text>}
                  <Pressable
                    style={styles.removeBtn}
                    onPress={() => handleRemoveItem(index)}
                    disabled={isSaving}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('grocery.remove_item', { name: item.name })}
                  >
                    <Ionicons name="close" size={18} color={MUTED} />
                  </Pressable>
                </View>
              ))}
              {/* The next line on the card: write an item and its amount, then add. */}
              <View style={styles.cardRow}>
                <TextInput
                  ref={itemInputRef}
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder={t('grocery.item_name_placeholder')}
                  placeholderTextColor="#A39F97"
                  style={[styles.cardInput, noWebOutline]}
                  maxLength={80}
                  returnKeyType="done"
                  onSubmitEditing={handleAddItem}
                  accessible
                  accessibilityLabel={t('grocery.item_name_placeholder')}
                  accessibilityHint={t('grocery.add_item_name_hint')}
                />
                <TextInput
                  value={itemQty}
                  onChangeText={setItemQty}
                  placeholder={t('grocery.qty_short')}
                  placeholderTextColor="#A39F97"
                  style={[styles.qtyInput, hand, noWebOutline]}
                  maxLength={12}
                  returnKeyType="done"
                  onSubmitEditing={handleAddItem}
                  accessible
                  accessibilityLabel={t('grocery.quantity')}
                  accessibilityHint={t('grocery.add_item_qty_hint')}
                />
              </View>
              <Pressable
                onPress={handleAddItem}
                disabled={!itemName.trim()}
                style={({ pressed }) => [
                  styles.addLink,
                  (!itemName.trim() || pressed) && styles.dim,
                ]}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t('grocery.add_item')}
                accessibilityState={{ disabled: !itemName.trim() }}
              >
                <Text style={[styles.addLinkText, hand]}>+ {t('grocery.add_item')}</Text>
              </Pressable>
            </View>

            {/* Keep private, as a box ticked in pen. */}
            <Pressable
              onPress={() => setIsPrivate((v) => !v)}
              style={styles.privateRow}
              accessible
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isPrivate }}
              accessibilityLabel={t('grocery.private_list')}
              accessibilityHint={t('grocery.keep_private_hint')}
            >
              <View style={[styles.box, { borderColor: C.textSecondary }]}>
                <PenTick checked={isPrivate} size={ms(24)} color={C.primary} style={styles.tick} />
              </View>
              <View style={styles.privateText}>
                <Text style={[styles.privateLabel, { color: C.textPrimary }]}>
                  {t('grocery.keep_private')}
                </Text>
                <Text style={[styles.privateSub, { color: C.textSecondary }]}>
                  {t('grocery.keep_private_hint')}
                </Text>
              </View>
            </Pressable>

            {!!error && <Text style={[styles.errorText, { color: C.danger }]}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: C.primary },
                (!canSave || pressed) && styles.dim,
              ]}
              onPress={handleSave}
              disabled={!canSave}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === 'create' ? t('grocery.save_list') : t('grocery.save_changes')}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// The index card is paper, so it keeps its light colours in dark mode.
const CARD = lightColors.receipt;
const INK = lightColors.receiptInk;
const MUTED = lightColors.receiptMuted;
const RULE = 'rgba(59,111,191,0.18)';
const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as ViewStyle;

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
  body: { padding: ms(20), paddingTop: ms(8), paddingBottom: ms(36), gap: ms(16) },
  card: {
    backgroundColor: CARD,
    borderRadius: ms(4),
    paddingHorizontal: ms(14),
    paddingBottom: ms(4),
    transform: [{ rotate: '-0.5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(6) },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHead: {
    minHeight: 46,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(184,69,64,0.45)',
  },
  cardTitle: { fontSize: mf(19), color: INK },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(10),
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: RULE,
  },
  itemName: { flex: 1, fontSize: mf(15.5), ...font.semibold, color: INK },
  itemQty: { fontSize: mf(20), color: '#3B6FBF', writingDirection: 'ltr' },
  removeBtn: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  cardInput: {
    flex: 1,
    minWidth: 0,
    fontSize: mf(15.5),
    ...font.medium,
    color: INK,
    paddingVertical: ms(8),
  },
  qtyInput: {
    width: ms(70),
    fontSize: mf(20),
    color: '#3B6FBF',
    paddingVertical: ms(4),
    textAlign: 'right',
  },
  addLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  addLinkText: { fontSize: mf(20), color: '#3B6FBF' },
  emptyItems: { fontSize: mf(13.5), ...font.regular, color: MUTED, paddingVertical: ms(10) },
  privateRow: { flexDirection: 'row', alignItems: 'center', gap: ms(12), minHeight: 48 },
  box: {
    width: ms(22),
    height: ms(22),
    borderWidth: 2.2,
    borderRadius: ms(4),
    transform: [{ rotate: '-2deg' }],
  },
  tick: { position: 'absolute', left: 0, top: -ms(9) },
  privateText: { flex: 1 },
  privateLabel: { fontSize: mf(15.5), ...font.semibold },
  privateSub: { fontSize: mf(13), ...font.regular, marginTop: ms(1) },
  errorText: { fontSize: mf(13) },
  primaryBtn: {
    minHeight: 52,
    borderRadius: ms(17),
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
  dim: { opacity: 0.5 },
});
