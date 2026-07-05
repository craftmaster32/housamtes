import { useState, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { type GroceryList } from '@stores/groceryStore';
import { Alert } from '@lib/alert';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

interface SavedListsSectionProps {
  lists: GroceryList[];
  isLoading: boolean;
  myId: string;
  hasDraftItems: boolean;
  onLoadList: (list: GroceryList) => void;
  onDeleteList: (listId: string) => void;
  onSetListReminder: (list: GroceryList) => void;
}

export function SavedListsSection({
  lists,
  isLoading,
  myId,
  hasDraftItems,
  onLoadList,
  onDeleteList,
  onSetListReminder,
}: SavedListsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((v) => !v);
  }, []);

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
      <Pressable
        style={styles.headerRow}
        onPress={handleToggle}
        accessible
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t('grocery.saved_lists_count', { count: lists.length })}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>📋</Text>
          <Text style={styles.headerLabel}>{t('grocery.saved_lists')}</Text>
          {lists.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{lists.length}</Text>
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={C.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {isLoading && <ActivityIndicator size="small" color={C.primary} style={styles.loader} />}

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
                {/* Delete — only creator can delete */}
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
      borderRadius: 16,
      borderWidth: 1,
      borderColor: C.border,
      overflow: 'hidden',
      marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      minHeight: 48,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerIcon: { fontSize: 16 },
    headerLabel: { fontSize: 15, ...font.semibold, color: C.textPrimary },
    badge: {
      backgroundColor: C.primary,
      borderRadius: 9999,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 5,
    },
    badgeText: { fontSize: 11, ...font.bold, color: '#fff' },
    body: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingHorizontal: 16,
      paddingBottom: 12,
      paddingTop: 8,
      gap: 6,
    },
    loader: { marginVertical: 12 },
    emptyWrap: { paddingVertical: 12, gap: 4 },
    emptyText: { fontSize: 14, ...font.semibold, color: C.textPrimary },
    emptyHint: { fontSize: 13, ...font.regular, color: C.textSecondary, lineHeight: 18 },
    listRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: C.surfaceSecondary,
      gap: 10,
    },
    listInfo: { flex: 1, gap: 2 },
    listNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    listName: { fontSize: 14, ...font.semibold, color: C.textPrimary, flexShrink: 1 },
    listMeta: { fontSize: 12, ...font.regular, color: C.textSecondary },
    listActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    loadBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: C.primary,
      minHeight: 44,
      justifyContent: 'center',
    },
    loadBtnText: { fontSize: 13, ...font.semibold, color: '#fff' },
  });
}
