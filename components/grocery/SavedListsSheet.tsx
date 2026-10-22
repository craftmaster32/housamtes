import { useCallback } from 'react';
import { View, Pressable, StyleSheet, Modal, FlatList } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { type GroceryList } from '@stores/groceryStore';
import { Alert } from '@lib/alert';
import { useThemedColors, darkColors, lightColors } from '@constants/colors';
import { font } from '@constants/typography';
import { useHeadingFont } from '@hooks/useHeadingFont';
import { useHandFont } from '@hooks/useHandFont';
import { SheetHeader } from '@components/bills/recurring/SheetHeader';
import { PaperTag } from '@components/bills/recurring/PaperTag';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { mf, ms } from '@utils/responsive';

// Index cards are paper, so they keep their light colours in dark mode.
const CARD = lightColors.receipt;
const INK = lightColors.receiptInk;
const MUTED = lightColors.receiptMuted;
const MARGIN = 'rgba(184,69,64,0.45)';

interface SavedListsSheetProps {
  visible: boolean;
  onClose: () => void;
  lists: GroceryList[];
  isLoading: boolean;
  myId: string;
  hasDraftItems: boolean;
  onLoadList: (list: GroceryList) => void;
  onDeleteList: (listId: string) => void;
  onCreateList: () => void;
  onEditList: (list: GroceryList) => void;
}

/** The saved lists as index cards in a bottom sheet: load one, or make a new one. */
export function SavedListsSheet({
  visible,
  onClose,
  lists,
  isLoading,
  myId,
  hasDraftItems,
  onLoadList,
  onDeleteList,
  onCreateList,
  onEditList,
}: SavedListsSheetProps): React.JSX.Element {
  const { t } = useTranslation();
  const c = useThemedColors();
  const heading = useHeadingFont('semibold');
  const hand = useHandFont();
  const overlay = c === darkColors ? 'rgba(0,0,0,0.6)' : 'rgba(34,32,29,0.42)';

  const handleCreate = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    onCreateList();
  }, [onCreateList]);

  const handleLoad = useCallback(
    (list: GroceryList): void => {
      const load = (): void => {
        Haptics.selectionAsync().catch(() => {});
        onLoadList(list);
      };
      if (!hasDraftItems) {
        load();
        return;
      }
      Alert.alert(t('grocery.replace_draft'), t('grocery.replace_draft_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('grocery.load_anyway'), onPress: load },
      ]);
    },
    [hasDraftItems, onLoadList, t]
  );

  const handleDelete = useCallback(
    (list: GroceryList): void => {
      Alert.alert(
        t('grocery.delete_list_title', { name: list.name }),
        t('grocery.delete_list_body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: (): void => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              onDeleteList(list.id);
            },
          },
        ]
      );
    },
    [onDeleteList, t]
  );

  const renderList = useCallback(
    ({ item: list, index }: { item: GroceryList; index: number }): React.JSX.Element => {
      const mine = list.createdBy === myId;
      return (
        <View style={[styles.card, index % 2 === 1 ? styles.tiltRight : styles.tiltLeft]}>
          <View style={styles.cardHead}>
            {list.isPrivate && <Ionicons name="lock-closed" size={14} color={MUTED} />}
            <Text style={[styles.cardName, heading]} numberOfLines={1}>
              {list.name}
            </Text>
            {mine && (
              <>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onEditList(list);
                  }}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.edit_name', { name: list.name })}
                >
                  <Ionicons name="create-outline" size={18} color={MUTED} />
                </Pressable>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => handleDelete(list)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.delete_name', { name: list.name })}
                >
                  <Ionicons name="trash-outline" size={18} color={MUTED} />
                </Pressable>
              </>
            )}
          </View>
          <View style={styles.cardFoot}>
            <Text style={[styles.cardMeta, hand]}>
              {t(mine ? 'grocery.item_count_yours' : 'grocery.item_count', {
                count: list.items.length,
              })}
            </Text>
            <PaperTag label={t('grocery.load')} onPress={() => handleLoad(list)} />
          </View>
        </View>
      );
    },
    [myId, heading, hand, onEditList, handleDelete, handleLoad, t]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />
        <View style={[styles.sheet, { backgroundColor: c.background }]} accessibilityViewIsModal>
          <SheetHeader
            eyebrow={t('nav.grocery')}
            title={t('grocery.saved_lists')}
            onClose={onClose}
          />
          <Pressable
            onPress={handleCreate}
            style={({ pressed }) => [styles.newLink, pressed && styles.pressed]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.new_list')}
            accessibilityHint={t('grocery.create_list_body')}
          >
            <Text style={[styles.newText, hand, { color: c.primary }]}>
              + {t('grocery.new_list')}
            </Text>
          </Pressable>
          <FlatList
            data={lists}
            keyExtractor={(l) => l.id}
            renderItem={renderList}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              isLoading ? (
                <LoadingSpinner size={64} style={styles.loader} />
              ) : (
                <View style={styles.empty}>
                  <Text style={[styles.emptyTitle, { color: c.textPrimary }]}>
                    {t('grocery.no_saved_lists')}
                  </Text>
                  <Text style={[styles.emptyHint, { color: c.textSecondary }]}>
                    {t('grocery.no_saved_lists_hint')}
                  </Text>
                </View>
              )
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: ms(26),
    borderTopRightRadius: ms(26),
    maxHeight: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  newLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginStart: ms(20),
  },
  newText: { fontSize: mf(21) },
  list: { paddingHorizontal: ms(20), paddingTop: ms(6), paddingBottom: ms(32), gap: ms(14) },
  card: {
    backgroundColor: CARD,
    borderRadius: ms(4),
    paddingHorizontal: ms(14),
    paddingBottom: ms(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: ms(5) },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  tiltLeft: { transform: [{ rotate: '-0.5deg' }] },
  tiltRight: { transform: [{ rotate: '0.5deg' }] },
  // The red line under an index card's heading.
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ms(6),
    minHeight: 48,
    borderBottomWidth: 2,
    borderBottomColor: MARGIN,
  },
  cardName: { flex: 1, fontSize: mf(19), color: INK },
  iconBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: ms(10),
  },
  cardMeta: { fontSize: mf(19), color: MUTED, flexShrink: 1 },
  loader: { marginVertical: ms(20) },
  empty: { paddingVertical: ms(16), gap: ms(4) },
  emptyTitle: { fontSize: mf(15), ...font.semibold },
  emptyHint: { fontSize: mf(13.5), ...font.regular, lineHeight: mf(19) },
  pressed: { opacity: 0.6 },
});
