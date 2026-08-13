import { useState, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { type GroceryList } from '@stores/groceryStore';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

import { mf, ms } from '@utils/responsive';
interface SavedListsSectionProps {
  lists: GroceryList[];
  isLoading: boolean;
  myId: string;
  hasDraftItems: boolean;
  onLoadList: (list: GroceryList) => void;
  onDeleteList: (listId: string) => void;
  onSetListReminder: (list: GroceryList) => void;
  onCreateList: () => void;
  onEditList: (list: GroceryList) => void;
}

export function SavedListsSection({
  lists,
  isLoading,
  myId,
  hasDraftItems,
  onLoadList,
  onDeleteList,
  onSetListReminder,
  onCreateList,
  onEditList,
}: SavedListsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((v) => !v);
  }, []);

  const handleCreate = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    onCreateList();
  }, [onCreateList]);

  const handleEdit = useCallback(
    (list: GroceryList): void => {
      Haptics.selectionAsync().catch(() => {});
      onEditList(list);
    },
    [onEditList]
  );

  const handleLoad = useCallback(
    (list: GroceryList): void => {
      if (hasDraftItems) {
        Alert.alert(t('grocery.replace_draft'), t('grocery.replace_draft_body'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('grocery.load_anyway'),
            onPress: (): void => {
              Haptics.selectionAsync().catch(() => {});
              onLoadList(list);
            },
          },
        ]);
      } else {
        Haptics.selectionAsync().catch(() => {});
        onLoadList(list);
      }
    },
    [hasDraftItems, onLoadList, t]
  );

  const handleSetReminder = useCallback(
    (list: GroceryList): void => {
      Haptics.selectionAsync().catch(() => {});
      onSetListReminder(list);
    },
    [onSetListReminder]
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

  return (
    <View style={styles.container}>
      {/* Collapsible header */}
      <View style={styles.headerRow}>
        <Pressable
          style={styles.headerLeft}
          onPress={handleToggle}
          accessible
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={t('grocery.saved_lists_count', { count: lists.length })}
        >
          <Ionicons name="bookmarks-outline" size={16} color={C.textSecondary} />

          <Text style={styles.headerLabel}>{t('grocery.saved_lists')}</Text>
          {lists.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lists.length}</Text>
            </View>
          )}
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.newBtn}
            onPress={handleCreate}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.new_list')}
            accessibilityHint={t('grocery.create_list_body')}
          >
            <Ionicons name="add" size={16} color={C.primary} />
            <Text style={styles.newBtnText}>{t('grocery.new_list')}</Text>
          </Pressable>
          <Pressable
            style={styles.chevronBtn}
            onPress={handleToggle}
            accessible
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={t('grocery.saved_lists')}
          >
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={C.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {expanded && (
        <View style={styles.body}>
          {isLoading && <LoadingSpinner size={64} style={styles.loader} />}

          {!isLoading && lists.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>{t('grocery.no_saved_lists')}</Text>
              <Text style={styles.emptyHint}>{t('grocery.no_saved_lists_hint')}</Text>
            </View>
          )}

          {lists.map((list) => (
            <View key={list.id} style={styles.listRow}>
              <View style={styles.listInfo}>
                <View style={styles.listNameRow}>
                  {list.isPrivate && (
                    <Ionicons name="lock-closed" size={12} color="rgba(139,92,246,0.7)" />
                  )}
                  <Text style={styles.listName} numberOfLines={1}>
                    {list.name}
                  </Text>
                </View>
                <Text style={styles.listMeta}>
                  {t(list.createdBy === myId ? 'grocery.item_count_yours' : 'grocery.item_count', {
                    count: list.items.length,
                  })}
                </Text>
              </View>

              <View style={styles.listActions}>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => handleSetReminder(list)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.remind_me_about_list', { name: list.name })}
                >
                  <Ionicons name="alarm-outline" size={17} color={C.textSecondary} />
                </Pressable>
                {/* Edit & delete — only the creator can change their list */}
                {list.createdBy === myId && (
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => handleEdit(list)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('grocery.edit_name', { name: list.name })}
                  >
                    <Ionicons name="create-outline" size={17} color={C.textSecondary} />
                  </Pressable>
                )}
                {list.createdBy === myId && (
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => handleDelete(list)}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('grocery.delete_name', { name: list.name })}
                  >
                    <Ionicons name="trash-outline" size={17} color={C.textDisabled} />
                  </Pressable>
                )}
                <Pressable
                  style={styles.loadBtn}
                  onPress={() => handleLoad(list)}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t('grocery.load_into_draft', { name: list.name })}
                >
                  <Text style={styles.loadBtnText}>{t('grocery.load')}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(C: ColorTokens) {
  return StyleSheet.create({
    container: {
      backgroundColor: C.surface,
      borderRadius: ms(16),
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      marginBottom: ms(16),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: ms(16),
      paddingRight: ms(8),
      minHeight: ms(48),
    },
    headerLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      paddingVertical: ms(14),
    },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: ms(2) },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(3),
      paddingHorizontal: ms(10),
      paddingVertical: ms(8),
      minHeight: ms(44),
      borderRadius: ms(10),
      backgroundColor: C.primaryTint,
    },
    newBtnText: { fontSize: mf(13), ...font.semibold, color: C.primary },
    chevronBtn: {
      width: ms(44),
      height: ms(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerLabel: { fontSize: mf(15), ...font.semibold, color: C.textPrimary },
    badge: {
      backgroundColor: C.primary,
      borderRadius: 9999,
      minWidth: ms(20),
      height: ms(20),
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: ms(5),
    },
    badgeText: { fontSize: mf(11), ...font.bold, color: '#fff' },
    body: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingHorizontal: ms(16),
      paddingBottom: ms(12),
      paddingTop: ms(8),
      gap: ms(6),
    },
    loader: { marginVertical: ms(12) },
    emptyWrap: { paddingVertical: ms(12), gap: ms(4) },
    emptyText: { fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    emptyHint: { fontSize: mf(13), ...font.regular, color: C.textSecondary, lineHeight: mf(18) },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: ms(10),
      paddingHorizontal: ms(12),
      borderRadius: ms(12),
      backgroundColor: C.surfaceSecondary,
      gap: ms(10),
    },
    listInfo: { flex: 1, gap: ms(2) },
    listNameRow: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
    listName: { fontSize: mf(14), ...font.semibold, color: C.textPrimary, flexShrink: 1 },
    listMeta: { fontSize: mf(12), ...font.regular, color: C.textSecondary },
    listActions: { flexDirection: 'row', alignItems: 'center', gap: ms(4) },
    iconBtn: { width: ms(44), height: ms(44), justifyContent: 'center', alignItems: 'center' },
    loadBtn: {
      paddingHorizontal: ms(14),
      paddingVertical: ms(10),
      borderRadius: ms(8),
      backgroundColor: C.primary,
      minHeight: ms(44),
      justifyContent: 'center',
    },
    loadBtnText: { fontSize: mf(13), ...font.semibold, color: '#fff' },
  });
}
