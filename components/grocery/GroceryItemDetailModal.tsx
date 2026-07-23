import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { enUS, es as dateFnsEs, he as dateFnsHe } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useHousematesStore } from '@stores/housematesStore';
import { useThemedColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { type GroceryItem } from '@stores/groceryStore';
import { UserAvatar } from '@components/shared/UserAvatar';

export interface GroceryItemDetailModalProps {
  item: GroceryItem | null;
  visible: boolean;
  myId: string;
  onClose: () => void;
  onSaveComment: (id: string, comment: string) => Promise<void>;
}

export function GroceryItemDetailModal({
  item,
  visible,
  myId,
  onClose,
  onSaveComment,
}: GroceryItemDetailModalProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const C = useThemedColors();
  const s = useMemo(() => makeModalStyles(), []);
  const headingFont = useHeadingFont('bold');
  const housemate = useHousematesStore((st) => st.housemates.find((h) => h.id === item?.addedBy));

  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setComment(item?.comment ?? '');
    setSaveError(null);
  }, [item]);

  const handleCommentChange = useCallback((v: string): void => {
    setComment(v);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!item || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveComment(item.id, comment.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
    } catch {
      setSaveError(t('grocery.could_not_save_note'));
    } finally {
      setIsSaving(false);
    }
  }, [item, comment, onSaveComment, onClose, isSaving, t]);

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
        <View style={[s.sheet, { backgroundColor: C.surface }]}>
          {item && (
            <>
              <View style={[s.handle, { backgroundColor: C.border }]} />
              <View style={s.header}>
                <Text style={[s.title, headingFont, { color: C.textPrimary }]}>
                  {t('grocery.item_details')}
                </Text>
                <Pressable
                  onPress={onClose}
                  style={s.closeBtn}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.close_details')}
                >
                  <Ionicons name="close" size={22} color={C.textSecondary} />
                </Pressable>
              </View>

              <Text
                style={[s.itemName, { color: C.textPrimary }, item.isChecked && s.itemNameDone]}
              >
                {item.name}
              </Text>

              <View style={s.meta}>
                {!!item.quantity && item.quantity !== '1' && (
                  <View style={[s.qtyBadge, { backgroundColor: C.secondary }]}>
                    <Text style={[s.qtyText, { color: C.textSecondary }]}>{item.quantity}</Text>
                  </View>
                )}
                <UserAvatar userId={item.addedBy} size={20} />
                <Text style={[s.metaText, { color: C.textSecondary }]}>
                  {t('grocery.added_by_meta', { name: addedByName, time: timeAgo })}
                </Text>
              </View>

              <View
                style={[
                  s.commentBox,
                  { backgroundColor: C.surfaceSecondary, borderColor: C.border },
                ]}
              >
                <TextInput
                  value={comment}
                  onChangeText={handleCommentChange}
                  placeholder={t('grocery.add_note_placeholder')}
                  placeholderTextColor={C.textSecondary}
                  style={[s.commentInput, { color: C.textPrimary }]}
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
              {!!saveError && <Text style={s.saveError}>{saveError}</Text>}

              <View style={s.actions}>
                <Pressable
                  onPress={onClose}
                  style={[s.btn, { borderColor: C.border }]}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Text style={[s.btnText, { color: C.textSecondary }]}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  style={[
                    s.btn,
                    s.btnPrimary,
                    { backgroundColor: C.primary },
                    isSaving && s.btnOff,
                  ]}
                  accessible
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSaving }}
                  accessibilityLabel={isSaving ? t('grocery.saving') : t('grocery.save_note')}
                >
                  <Text style={[s.btnText, s.btnPrimaryText]}>
                    {isSaving ? t('grocery.saving') : t('grocery.save_note')}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeModalStyles(): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      padding: 22,
      paddingBottom: 40,
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 2 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 21, letterSpacing: -0.3 },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemName: { fontSize: 22, ...font.bold, lineHeight: 30 },
    itemNameDone: { textDecorationLine: 'line-through', opacity: 0.5 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    qtyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    qtyText: { fontSize: 13, ...font.bold },
    metaText: { fontSize: 13, ...font.regular },
    commentBox: { borderRadius: 12, borderWidth: 1, padding: 12 },
    commentInput: { fontSize: 15, ...font.regular, minHeight: 72 },
    saveError: { fontSize: 12, color: '#D94F4F' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
    btn: {
      flex: 1,
      height: 50,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
    },
    btnPrimary: {
      borderWidth: 0,
      shadowColor: '#3B6FBF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 6,
    },
    btnOff: { opacity: 0.5 },
    btnText: { fontSize: 15, ...font.bold },
    btnPrimaryText: { color: '#FFFFFF' },
  });
}
