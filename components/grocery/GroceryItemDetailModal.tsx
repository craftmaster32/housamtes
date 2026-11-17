import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { enUS, es as dateFnsEs, he as dateFnsHe } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { useThemedColors, darkColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { type GroceryItem } from '@stores/groceryStore';
import {
  CATEGORY_KEYS,
  categoryForKey,
  detectCategoryKey,
  type CategoryKey,
} from '@utils/groceryCategory';
import { UserAvatar } from '@components/shared/UserAvatar';
import { ItemPhotoRow } from '@components/grocery/ItemPhotoRow';

import { mf, ms } from '@utils/responsive';

export interface GroceryItemDetailModalProps {
  item: GroceryItem | null;
  visible: boolean;
  myId: string;
  onClose: () => void;
  onSaveComment: (id: string, comment: string) => Promise<void>;
  /** Moves the item to another aisle — anyone in the house can do this. */
  onSetCategory: (id: string, category: CategoryKey) => Promise<void>;
  /** Saves a new name / quantity — only offered on items you added. */
  onUpdate: (id: string, name: string, quantity: string) => Promise<void>;
  /** Removes the item; the caller confirms first when it's a housemate's item. */
  onDelete: (id: string) => void;
  /** Saved photo for this item's name, if the house has one. */
  photoUrl?: string;
  /** Uploads a picked photo and remembers it for every item with this name. */
  onSetPhoto: (name: string, localUri: string) => Promise<void>;
  onRemovePhoto: (name: string) => Promise<void>;
}

export function GroceryItemDetailModal({
  item,
  visible,
  myId,
  onClose,
  onSaveComment,
  onSetCategory,
  onUpdate,
  onDelete,
  photoUrl,
  onSetPhoto,
  onRemovePhoto,
}: GroceryItemDetailModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeModalStyles(), []);
  const headingFont = useHeadingFont('semibold');
  const hand = useHandFont();
  const overlay = C === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';
  const housemate = useHousematesStore((st) => st.housemates.find((h) => h.id === item?.addedBy));

  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>('other');
  const [showAisles, setShowAisles] = useState(false);
  // The aisle the item sits in right now (picked by hand, or guessed from its name).
  const currentCategory: CategoryKey = item
    ? (item.category ?? detectCategoryKey(item.name))
    : 'other';

  useEffect(() => {
    setComment(item?.comment ?? '');
    setName(item?.name ?? '');
    setQuantity(item?.quantity ?? '');
    setCategory(item ? (item.category ?? detectCategoryKey(item.name)) : 'other');
    setShowAisles(false);
    setSaveError(null);
  }, [item]);

  // The dim backdrop fades in place; only the sheet slides up from the bottom.
  const slide = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  useEffect(() => {
    if (!visible) return;
    slide.setValue(Dimensions.get('window').height);
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: Platform.OS !== 'web',
      damping: 22,
      stiffness: 220,
      mass: 0.9,
    }).start();
  }, [visible, slide]);

  const toggleAisles = useCallback((): void => setShowAisles((v) => !v), []);
  const pickCategory = useCallback((key: CategoryKey): void => {
    Haptics.selectionAsync().catch(() => {});
    setCategory(key);
    setShowAisles(false);
    setSaveError(null);
  }, []);

  const handleCommentChange = useCallback((v: string): void => {
    setComment(v);
    setSaveError(null);
  }, []);

  const canEdit = !!item && item.addedBy === myId;
  const categoryChanged = category !== currentCategory;

  const handleSave = useCallback(async (): Promise<void> => {
    if (!item || isSaving) return;
    const newName = name.trim();
    if (canEdit && !newName) {
      setSaveError(t('grocery.item_name_required'));
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      if (canEdit && (newName !== item.name || quantity.trim() !== item.quantity)) {
        await onUpdate(item.id, newName, quantity.trim());
      }
      if (comment.trim() !== (item.comment ?? '')) {
        await onSaveComment(item.id, comment.trim());
      }
      if (categoryChanged) {
        await onSetCategory(item.id, category);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch {
      setSaveError(
        canEdit || categoryChanged ? t('grocery.could_not_save') : t('grocery.could_not_save_note')
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    item,
    comment,
    name,
    quantity,
    canEdit,
    category,
    categoryChanged,
    onSaveComment,
    onSetCategory,
    onUpdate,
    onClose,
    isSaving,
    t,
  ]);

  const handleDelete = useCallback((): void => {
    if (!item) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete(item.id);
  }, [item, onDelete]);

  const saveLabel = canEdit || categoryChanged ? t('grocery.save_changes') : t('grocery.save_note');
  const picked = categoryForKey(category);
  // Private items live in "My list", not in an aisle, so there's nothing to move.
  const showCategory = !!item && !item.isPersonal;

  const addedByName = item
    ? item.addedBy === myId
      ? t('common.you')
      : (housemate?.name ?? t('common.someone'))
    : '';
  const dateFnsLocale =
    ({ en: enUS, es: dateFnsEs, he: dateFnsHe } as const)[i18n.language as 'en' | 'es' | 'he'] ??
    enUS;
  const timeAgo = item
    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: dateFnsLocale })
    : '';

  const qtyShown = !canEdit && !!item?.quantity && item.quantity !== '1';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[s.overlay, { backgroundColor: overlay }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('grocery.close_details')}
        />
        <Animated.View
          style={[s.sheet, { backgroundColor: C.background, transform: [{ translateY: slide }] }]}
          accessibilityViewIsModal
        >
          {item && (
            <>
              <SheetHeader
                eyebrow={t('nav.grocery')}
                title={t('grocery.item_details')}
                onClose={onClose}
              />
              <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
                {/* The item on a slip of the bag's brown paper. */}
                <View style={[s.slip, { backgroundColor: C.kraft }]}>
                  {canEdit ? (
                    <View style={s.editRow}>
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder={t('grocery.item_name_placeholder')}
                        placeholderTextColor={C.kraftMuted}
                        style={[
                          s.nameInput,
                          headingFont,
                          { color: C.kraftInk, borderBottomColor: C.kraftRule },
                          noWebOutline,
                        ]}
                        accessibilityLabel={t('grocery.item_name_edit')}
                        accessibilityHint={t('grocery.item_name_edit_hint')}
                      />
                      <TextInput
                        value={quantity}
                        onChangeText={setQuantity}
                        placeholder={t('grocery.qty_edit_placeholder')}
                        placeholderTextColor={C.kraftMuted}
                        style={[s.qtyInput, hand, { borderBottomColor: C.kraftRule }, noWebOutline]}
                        accessibilityLabel={t('grocery.qty_edit')}
                        accessibilityHint={t('grocery.qty_edit_hint')}
                      />
                    </View>
                  ) : (
                    <View style={s.nameRow}>
                      <Text
                        style={[
                          s.itemName,
                          headingFont,
                          { color: C.kraftInk },
                          item.isChecked && s.done,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {qtyShown && <Text style={[s.qty, hand]}>{item.quantity}</Text>}
                    </View>
                  )}
                  <View style={s.meta}>
                    <UserAvatar userId={item.addedBy} size={20} />
                    <Text style={[s.metaText, { color: C.kraftMuted }]}>
                      {t('grocery.added_by_meta', { name: addedByName, time: timeAgo })}
                    </Text>
                  </View>
                </View>

                <ItemPhotoRow
                  key={item.id}
                  name={item.name}
                  photoUrl={photoUrl}
                  onSetPhoto={onSetPhoto}
                  onRemovePhoto={onRemovePhoto}
                />

                {showCategory && (
                  <View style={s.aisleBlock}>
                    <View style={s.aisleRow}>
                      <Text style={[s.aisleLabel, { color: C.textSecondary }]}>
                        {t('grocery.category_label')}
                      </Text>
                      <View style={[s.chip, { backgroundColor: C.surfaceSecondary }]}>
                        <Ionicons name={picked.icon} size={16} color={C.textPrimary} />
                        <Text style={[s.chipText, { color: C.textPrimary }]}>
                          {t(picked.labelKey)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={toggleAisles}
                        style={({ pressed }) => [s.changeBtn, pressed && s.dim]}
                        accessible
                        accessibilityRole="button"
                        accessibilityState={{ expanded: showAisles }}
                        accessibilityLabel={t('grocery.change_category')}
                        accessibilityHint={t('grocery.change_category_hint')}
                      >
                        <Text style={[s.changeText, { color: C.primary }]}>
                          {t('grocery.change_category')}
                        </Text>
                        <Ionicons
                          name={showAisles ? 'chevron-up' : 'chevron-down'}
                          size={16}
                          color={C.primary}
                        />
                      </Pressable>
                    </View>
                    {showAisles && (
                      <View style={s.chipGrid}>
                        {CATEGORY_KEYS.map((key) => {
                          const cat = categoryForKey(key);
                          const selected = key === category;
                          const ink = selected ? C.primary : C.textPrimary;
                          const label = t(cat.labelKey);
                          return (
                            <Pressable
                              key={key}
                              onPress={() => pickCategory(key)}
                              style={({ pressed }) => [
                                s.chip,
                                s.chipOption,
                                { backgroundColor: C.surface, borderColor: C.border },
                                selected && { borderColor: C.primary },
                                pressed && s.dim,
                              ]}
                              accessible
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              accessibilityLabel={t('grocery.pick_category', { name: label })}
                            >
                              <Ionicons name={cat.icon} size={16} color={C.textSecondary} />
                              <Text style={[s.chipText, { color: ink }]}>{label}</Text>
                              {selected && (
                                <Ionicons name="checkmark" size={16} color={C.primary} />
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* The note, on a yellow sticky note. */}
                <View style={s.note}>
                  <TextInput
                    value={comment}
                    onChangeText={handleCommentChange}
                    placeholder={t('grocery.add_note_placeholder')}
                    placeholderTextColor="#8A7A55"
                    style={[s.noteInput, hand, noWebOutline]}
                    multiline
                    numberOfLines={3}
                    maxLength={200}
                    textAlignVertical="top"
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={t('grocery.item_note')}
                    accessibilityHint={t('grocery.item_note_hint')}
                  />
                </View>
                {!!saveError && <Text style={[s.saveError, { color: C.danger }]}>{saveError}</Text>}

                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  style={({ pressed }) => [
                    s.primary,
                    { backgroundColor: C.primary },
                    (isSaving || pressed) && s.dim,
                  ]}
                  accessible
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSaving }}
                  accessibilityLabel={isSaving ? t('grocery.saving') : saveLabel}
                >
                  <Text style={s.primaryText}>{isSaving ? t('grocery.saving') : saveLabel}</Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => [s.remove, pressed && s.dim]}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.delete_item_name', { name: item.name })}
                  accessibilityHint={t('grocery.remove_item_hint')}
                >
                  <Text style={[s.removeText, { color: C.negative }]}>
                    {t('grocery.remove_from_list')}
                  </Text>
                </Pressable>
              </ScrollView>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// The browser draws its own focus box around inputs; the lines are enough.
const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as ViewStyle;

function makeModalStyles(): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
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
    slip: {
      borderRadius: ms(4),
      paddingHorizontal: ms(16),
      paddingVertical: ms(14),
      gap: ms(8),
      transform: [{ rotate: '-0.4deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(5) },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
    nameRow: { flexDirection: 'row', alignItems: 'baseline', gap: ms(8), flexWrap: 'wrap' },
    itemName: { fontSize: mf(26), lineHeight: mf(33), letterSpacing: -0.3 },
    done: { textDecorationLine: 'line-through', opacity: 0.6 },
    qty: { fontSize: mf(24), color: '#3B6FBF', writingDirection: 'ltr' },
    editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: ms(12) },
    nameInput: {
      flex: 1,
      minWidth: 0,
      fontSize: mf(22),
      paddingVertical: ms(6),
      borderBottomWidth: 2,
    },
    qtyInput: {
      width: ms(84),
      fontSize: mf(22),
      color: '#3B6FBF',
      paddingVertical: ms(6),
      borderBottomWidth: 2,
      textAlign: 'center',
    },
    meta: { flexDirection: 'row', alignItems: 'center', gap: ms(7) },
    metaText: { fontSize: mf(13), ...font.medium },
    note: {
      backgroundColor: '#FCE9A8',
      paddingHorizontal: ms(14),
      paddingVertical: ms(10),
      transform: [{ rotate: '0.6deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(3) },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 2,
    },
    noteInput: {
      minHeight: ms(70),
      fontSize: mf(20),
      lineHeight: mf(24),
      color: '#3A3221',
      padding: 0,
    },
    aisleBlock: { gap: ms(10) },
    aisleRow: { flexDirection: 'row', alignItems: 'center', gap: ms(10) },
    aisleLabel: { fontSize: mf(14), ...font.medium },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      paddingHorizontal: ms(12),
      borderRadius: 999,
      minHeight: 36,
      flexShrink: 1,
    },
    chipOption: { minHeight: 44, borderWidth: 1.5 },
    chipText: { fontSize: mf(14), ...font.semibold, flexShrink: 1 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
    changeBtn: {
      marginStart: 'auto',
      minHeight: 44,
      minWidth: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(4),
      paddingHorizontal: ms(4),
    },
    changeText: { fontSize: mf(15), ...font.semibold },
    saveError: { fontSize: mf(13) },
    primary: {
      minHeight: 52,
      borderRadius: ms(17),
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { fontSize: mf(16), ...font.semibold, color: '#FFFFFF' },
    remove: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    removeText: { fontSize: mf(15), ...font.semibold },
    dim: { opacity: 0.5 },
  });
}
