import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
  Switch,
  ActivityIndicator,
  type ViewStyle,
  type TextInput as RNTextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { type SavedListItem } from '@stores/groceryStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';

import { mf, ms } from '@utils/responsive';

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
  const styles = makeStyles(C);
  const headingFont = useHeadingFont('bold');
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

  const renderItem = useCallback(
    ({ item, index }: { item: SavedListItem; index: number }): React.JSX.Element => (
      <View style={styles.itemRow}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
          {item.quantity ? <Text style={styles.itemQty}>{`  ·  ${item.quantity}`}</Text> : null}
        </Text>
        <Pressable
          style={styles.itemRemoveBtn}
          onPress={() => handleRemoveItem(index)}
          disabled={isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('grocery.remove_item', { name: item.name })}
        >
          <Ionicons name="close" size={18} color={C.textSecondary} />
        </Pressable>
      </View>
    ),
    [styles, handleRemoveItem, isSaving, t, C.textSecondary]
  );

  const title = mode === 'create' ? t('grocery.new_list') : t('grocery.edit_list');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.backdrop} onPress={handleCancel} disabled={isSaving}>
        <Pressable style={styles.box} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <View style={styles.iconBadge}>
              <Ionicons
                name={mode === 'create' ? 'add-circle-outline' : 'create-outline'}
                size={28}
                color={C.primary}
              />
            </View>
          </View>

          <Text style={[styles.title, headingFont]}>{title}</Text>

          <TextInput
            value={listName}
            onChangeText={(v) => {
              setListName(v);
              setError(null);
            }}
            placeholder={t('grocery.list_name_placeholder')}
            placeholderTextColor={C.textSecondary}
            style={styles.nameInput}
            maxLength={60}
            returnKeyType="done"
            accessible
            accessibilityLabel={t('grocery.list_name')}
            accessibilityHint={t('grocery.list_name_hint')}
          />

          <View style={styles.privateRow}>
            <View style={styles.privateTextWrap}>
              <Text style={styles.privateLabel}>{t('grocery.keep_private')}</Text>
              <Text style={styles.privateSub}>{t('grocery.keep_private_hint')}</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: C.border, true: C.primary }}
              thumbColor="#fff"
              activeThumbColor="#fff"
              style={styles.switchLtr}
              accessible
              accessibilityRole="switch"
              accessibilityLabel={t('grocery.private_list')}
              accessibilityHint={t('grocery.keep_private_hint')}
              accessibilityState={{ checked: isPrivate }}
            />
          </View>

          {/* Add-item row */}
          <View style={styles.addItemRow}>
            <TextInput
              ref={itemInputRef}
              value={itemName}
              onChangeText={setItemName}
              placeholder={t('grocery.item_name_placeholder')}
              placeholderTextColor={C.textSecondary}
              style={styles.itemInput}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={handleAddItem}
              accessible
              accessibilityLabel={t('grocery.item_name_placeholder')}
            />
            <TextInput
              value={itemQty}
              onChangeText={setItemQty}
              placeholder={t('grocery.qty_short')}
              placeholderTextColor={C.textSecondary}
              style={styles.qtyInput}
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={handleAddItem}
              accessible
              accessibilityLabel={t('grocery.quantity')}
            />
            <Pressable
              style={[styles.addItemBtn, !itemName.trim() && styles.addItemBtnOff]}
              onPress={handleAddItem}
              disabled={!itemName.trim()}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('grocery.add_item')}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Items list */}
          {items.length === 0 ? (
            <Text style={styles.emptyItems}>{t('grocery.no_items_yet')}</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item, i) => `${item.name}-${i}`}
              renderItem={renderItem}
              style={styles.itemsList}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.primaryBtn, (!listName.trim() || isSaving) && styles.btnOff]}
            onPress={handleSave}
            disabled={!listName.trim() || isSaving}
            accessible
            accessibilityRole="button"
            accessibilityState={{ disabled: !listName.trim() || isSaving }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={mode === 'create' ? 'bookmark' : 'checkmark'}
                  size={16}
                  color="#fff"
                />
                <Text style={styles.primaryBtnText}>
                  {mode === 'create' ? t('grocery.save_list') : t('grocery.save_changes')}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={styles.skipBtn}
            onPress={handleCancel}
            disabled={isSaving}
            accessible
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving }}
          >
            <Text style={styles.skipBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: ms(24),
    },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,
    box: {
      width: '100%',
      backgroundColor: C.surface,
      borderRadius: ms(20),
      padding: ms(24),
      gap: ms(12),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(8) },
      shadowOpacity: 0.15,
      shadowRadius: 24,
      elevation: 10,
    },
    iconWrap: { alignItems: 'center' },
    iconBadge: {
      width: ms(60),
      height: ms(60),
      borderRadius: ms(30),
      backgroundColor: C.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: mf(20),
      ...font.bold,
      color: C.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.4,
    },
    nameInput: {
      height: ms(48),
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: ms(14),
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
    },
    privateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(12),
      padding: ms(14),
      gap: ms(10),
    },
    privateTextWrap: { flex: 1 },
    privateLabel: { fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    privateSub: { fontSize: mf(12), ...font.regular, color: C.textSecondary, marginTop: ms(2) },
    addItemRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8) },
    itemInput: {
      flex: 1,
      height: ms(46),
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: ms(14),
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
    },
    qtyInput: {
      width: ms(64),
      height: ms(46),
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      paddingHorizontal: ms(10),
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
      textAlign: 'center',
    },
    addItemBtn: {
      width: ms(46),
      height: ms(46),
      borderRadius: ms(12),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addItemBtnOff: { backgroundColor: C.textDisabled },
    itemsList: { maxHeight: ms(190) },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: ms(8),
      paddingHorizontal: ms(12),
      borderRadius: ms(10),
      backgroundColor: C.surfaceSecondary,
      marginBottom: ms(6),
      gap: ms(8),
    },
    itemName: { flex: 1, fontSize: mf(14), ...font.regular, color: C.textPrimary },
    itemQty: { ...font.regular, color: C.textSecondary },
    itemRemoveBtn: {
      width: ms(44),
      height: ms(44),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyItems: {
      fontSize: mf(13),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      paddingVertical: ms(8),
    },
    errorText: { fontSize: mf(13), color: '#D94F4F', textAlign: 'center' },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      minHeight: ms(50),
      borderRadius: ms(12),
      backgroundColor: C.primary,
    },
    btnOff: { backgroundColor: C.textDisabled },
    primaryBtnText: { fontSize: mf(15), ...font.semibold, color: '#fff' },
    skipBtn: { alignItems: 'center', paddingVertical: ms(10), minHeight: ms(44) },
    skipBtnText: { fontSize: mf(14), ...font.regular, color: C.textSecondary },
  });
}
