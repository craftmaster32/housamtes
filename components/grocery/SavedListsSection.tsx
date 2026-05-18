import { useState, useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type GroceryList } from '@stores/groceryStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { font } from '@constants/typography';

interface SavedListsSectionProps {
  lists: GroceryList[];
  isLoading: boolean;
  myId: string;
  hasDraftItems: boolean;
  onLoadList: (list: GroceryList) => void;
  onDeleteList: (listId: string) => void;
}

export function SavedListsSection({
  lists,
  isLoading,
  myId,
  hasDraftItems,
  onLoadList,
  onDeleteList,
}: SavedListsSectionProps): React.JSX.Element {
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((v) => !v);
  }, []);

  const handleLoad = useCallback((list: GroceryList): void => {
    if (hasDraftItems) {
      Alert.alert(
        'Replace draft?',
        'You already have items in your draft. Loading this list will add to it, not replace it. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Load anyway', onPress: (): void => { Haptics.selectionAsync().catch(() => {}); onLoadList(list); } },
        ]
      );
    } else {
      Haptics.selectionAsync().catch(() => {});
      onLoadList(list);
    }
  }, [hasDraftItems, onLoadList]);

  const handleDelete = useCallback((list: GroceryList): void => {
    Alert.alert(
      `Delete “${list.name}”?`,
      'This removes the saved list template. Items already on the shared list are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: (): void => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onDeleteList(list.id); },
        },
      ]
    );
  }, [onDeleteList]);

  return (
    <View style={styles.container}>
      {/* Collapsible header */}
      <Pressable
        style={styles.headerRow}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`Saved lists, ${lists.length} list${lists.length === 1 ? '' : 's'}`}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>📋</Text>
          <Text style={styles.headerLabel}>Saved Lists</Text>
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
          {isLoading && (
            <ActivityIndicator size="small" color={C.primary} style={styles.loader} />
          )}

          {!isLoading && lists.length === 0 && (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No saved lists yet.</Text>
              <Text style={styles.emptyHint}>
                {'After sharing a draft, choose "Save list" to build your templates.'}
              </Text>
            </View>
          )}

          {lists.map((list) => (
            <View key={list.id} style={styles.listRow}>
              <View style={styles.listInfo}>
                <View style={styles.listNameRow}>
                  {list.isPrivate && (
                    <Ionicons name="lock-closed" size={12} color="rgba(139,92,246,0.7)" />
                  )}
                  <Text style={styles.listName} numberOfLines={1}>{list.name}</Text>
                </View>
                <Text style={styles.listMeta}>
                  {list.items.length} item{list.items.length === 1 ? '' : 's'}
                  {list.createdBy === myId ? ' · yours' : ''}
                </Text>
              </View>

              <View style={styles.listActions}>
                {/* Delete — only creator can delete */}
                {list.createdBy === myId && (
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => handleDelete(list)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete ${list.name}`}
                  >
                    <Ionicons name="trash-outline" size={17} color={C.textDisabled} />
                  </Pressable>
                )}
                <Pressable
                  style={styles.loadBtn}
                  onPress={() => handleLoad(list)}
                  accessibilityRole="button"
                  accessibilityLabel={`Load ${list.name} into draft`}
                >
                  <Text style={styles.loadBtnText}>Load</Text>
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
      backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
      overflow: 'hidden', marginBottom: 16,
    },
    headerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14, minHeight: 48,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerIcon: { fontSize: 16 },
    headerLabel: { fontSize: 15, ...font.semibold, color: C.textPrimary },
    badge: {
      backgroundColor: C.primary, borderRadius: 9999,
      minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
    },
    badgeText: { fontSize: 11, ...font.bold, color: '#fff' },
    body: { borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8, gap: 6 },
    loader: { marginVertical: 12 },
    emptyWrap: { paddingVertical: 12, gap: 4 },
    emptyText: { fontSize: 14, ...font.semibold, color: C.textPrimary },
    emptyHint: { fontSize: 13, ...font.regular, color: C.textSecondary, lineHeight: 18 },
    listRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
      backgroundColor: C.surfaceSecondary, gap: 10,
    },
    listInfo: { flex: 1, gap: 2 },
    listNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    listName: { fontSize: 14, ...font.semibold, color: C.textPrimary, flexShrink: 1 },
    listMeta: { fontSize: 12, ...font.regular, color: C.textSecondary },
    listActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    loadBtn: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
      backgroundColor: C.primary, minHeight: 32, justifyContent: 'center',
    },
    loadBtnText: { fontSize: 13, ...font.semibold, color: '#fff' },
  });
}
