// app/(tabs)/grocery/index.tsx
// Grocery — v2 redesign.
// Same data flow as v1 (useGroceryStore, useAuthStore, useHousematesStore,
// useSettingsStore). Same complex features: 3 add modes (shared/private/draft),
// per-item swipe-to-delete, inline editing, quantity counters, shopping runs,
// duplicate detection across shared list. New: blue hero card, dark theme via
// useThemedColors, `type` ladder, `Header` UI primitive, fade-up entrance,
// press scale + haptics throughout.

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, { LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGroceryStore, type GroceryItem, type AddMode } from '@stores/groceryStore';
import { useAuthStore } from '@stores/authStore';
import { useBadgeStore } from '@stores/badgeStore';
import { useHousematesStore } from '@stores/housematesStore';
import { useSettingsStore } from '@stores/settingsStore';
import { colors, useThemedColors, type ColorTokens } from '@constants/colors';
import { Button, EmptyState, Header } from '@components/ui';
import { type } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { useFadeInUp, usePressScale } from '@utils/animations';

const ADD_MODE_KEY = 'grocery_add_mode';

const QUICK_ADDS = ['Milk', 'Bread', 'Trash Bags', 'Coffee', 'Butter', 'Olive Oil'];
const QTY_PRESETS = ['1', '2', '3'];

// ── Category detection ─────────────────────────────────────────────────────────
interface Category {
  label: string;
  icon: string;
  order: number;
}

const RULES: Array<{ re: RegExp; cat: Category }> = [
  {
    re: /banana|apple|avocado|tomato|carrot|onion|lettuce|orange|strawberry|grape|cucumber|pepper|lime|lemon|herb|spinach|broccoli|salad/i,
    cat: { label: 'Produce', icon: '🍎', order: 0 },
  },
  {
    re: /milk|oat milk|almond milk|egg|cheese|butter|yogurt|cream|dairy/i,
    cat: { label: 'Dairy & Fridge', icon: '🥛', order: 1 },
  },
  {
    re: /toilet|soap|trash|bin bag|sponge|paper towel|dish|laundry|detergent|bleach|towel|cleaning/i,
    cat: { label: 'Household', icon: '🧺', order: 2 },
  },
  {
    re: /chicken|beef|fish|salmon|tuna|pork|lamb|shrimp|sausage|meat|mince/i,
    cat: { label: 'Meat & Fish', icon: '🥩', order: 3 },
  },
  {
    re: /pasta|rice|bread|flour|sugar|salt|olive oil|oil|cereal|oats|coffee|tea|sauce|can|tin/i,
    cat: { label: 'Pantry', icon: '🥫', order: 4 },
  },
];
const OTHER_CAT: Category = { label: 'Other', icon: '📦', order: 99 };

function detectCategory(name: string): Category {
  return RULES.find((r) => r.re.test(name))?.cat ?? OTHER_CAT;
}

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors.avatar[Math.abs(h) % colors.avatar.length];
}

function elapsedLabel(startedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 1) return 'Just started';
  if (mins < 60) return `${mins} min at the store`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m at the store`;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function UserAvatar({ userId, size = 24 }: { userId: string; size?: number }): React.JSX.Element {
  const housemate = useHousematesStore((s) => s.housemates.find((h) => h.id === userId));
  const avatarUrl = housemate?.avatarUrl;
  const displayName = housemate?.name ?? '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarUrl ? 'transparent' : avatarColor(displayName),
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size }}
          contentFit="cover"
          accessibilityLabel={`${displayName} avatar`}
        />
      ) : (
        <Text style={{ color: '#fff', fontSize: Math.round(size * 0.44), fontWeight: '700' }}>
          {displayName[0].toUpperCase()}
        </Text>
      )}
    </View>
  );
}

// ── Item row ───────────────────────────────────────────────────────────────────
interface ItemRowProps {
  item: GroceryItem;
  myId: string;
  isDuplicate?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onUpdate: (id: string, name: string, quantity: string) => Promise<void>;
  C: ColorTokens;
}

function ItemRow({
  item,
  myId,
  isDuplicate = false,
  onToggle,
  onDelete,
  onIncrement,
  onDecrement,
  onUpdate,
  C,
}: ItemRowProps): React.JSX.Element {
  const styles = useMemo(() => makeStyles(C), [C]);
  const qtyNum = parseInt(item.quantity, 10);
  const hasCount = !isNaN(qtyNum) && qtyNum > 1;
  const bought = item.boughtCount ?? 0;
  const canEdit = item.addedBy === myId;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.quantity);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const press = usePressScale(0.985);

  const handleTap = useCallback((): void => {
    if (!hasCount) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggle(item.id);
  }, [hasCount, item.id, onToggle]);

  const handleDelete = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onDelete(item.id);
  }, [item.id, onDelete]);

  const handleDecrement = useCallback((): void => {
    if (bought === 0) return;
    Haptics.selectionAsync().catch(() => {});
    onDecrement(item.id);
  }, [bought, item.id, onDecrement]);

  const handleIncrement = useCallback((): void => {
    if (bought >= qtyNum) return;
    Haptics.selectionAsync().catch(() => {});
    onIncrement(item.id);
  }, [bought, qtyNum, item.id, onIncrement]);

  const startEdit = useCallback((): void => {
    setEditName(item.name);
    setEditQty(item.quantity);
    setSaveError(null);
    setIsEditing(true);
  }, [item.name, item.quantity]);

  const cancelEdit = useCallback((): void => {
    setSaveError(null);
    setIsEditing(false);
  }, []);

  const saveEdit = useCallback(async (): Promise<void> => {
    const trimmed = editName.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onUpdate(item.id, trimmed, editQty.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setIsEditing(false);
    } catch {
      setSaveError('Could not save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [editName, editQty, item.id, onUpdate, isSaving]);

  if (isEditing) {
    return (
      <Animated.View layout={LinearTransition.springify().damping(18)}>
        <View
          style={[
            styles.groceryItem,
            { backgroundColor: C.surface, borderColor: C.primary, gap: 8 },
          ]}
        >
          <TextInput
            value={editName}
            onChangeText={(v) => {
              setEditName(v);
              setSaveError(null);
            }}
            style={[
              styles.editNameInput,
              { backgroundColor: C.surfaceSecondary, borderColor: C.primary, color: C.textPrimary },
            ]}
            autoFocus
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder="Item name"
            placeholderTextColor={C.textSecondary}
          />
          <TextInput
            value={editQty}
            onChangeText={(v) => {
              setEditQty(v);
              setSaveError(null);
            }}
            style={[
              styles.editQtyInput,
              { backgroundColor: C.surfaceSecondary, borderColor: C.border, color: C.textPrimary },
            ]}
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder="Qty"
            placeholderTextColor={C.textSecondary}
          />
          <Pressable
            onPress={saveEdit}
            style={styles.editActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
          >
            <Ionicons name="checkmark" size={20} color={C.positive} />
          </Pressable>
          <Pressable
            onPress={cancelEdit}
            style={styles.editActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
          >
            <Ionicons name="close" size={20} color={C.textSecondary} />
          </Pressable>
        </View>
        {!!saveError && (
          <Text style={[type.caption, { color: C.danger, paddingHorizontal: 4, paddingTop: 4 }]}>
            {saveError}
          </Text>
        )}
      </Animated.View>
    );
  }

  const isPrivate = item.isPersonal && !item.isDraft;

  return (
    <Animated.View layout={LinearTransition.springify().damping(18)} style={press.animatedStyle}>
      <Pressable
        style={[
          styles.groceryItem,
          { backgroundColor: C.surface, borderColor: C.border },
          item.isChecked && { opacity: 0.5, borderColor: 'transparent' },
          isPrivate && { backgroundColor: C.accent, borderColor: C.primary + '30' },
        ]}
        onPress={handleTap}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.isChecked }}
        accessibilityLabel={isDuplicate ? `${item.name}, already on shared list` : item.name}
      >
        {hasCount ? (
          <View style={styles.counter}>
            <CtrBtn onPress={handleDecrement} disabled={bought === 0} symbol="−" C={C} />
            <Text style={[type.label, { color: C.textPrimary, minWidth: 32, textAlign: 'center' }]}>
              {bought}/{qtyNum}
            </Text>
            <CtrBtn onPress={handleIncrement} disabled={bought >= qtyNum} symbol="+" C={C} />
          </View>
        ) : (
          <Ionicons
            name={item.isChecked ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={item.isChecked ? C.positive : C.border}
          />
        )}
        <View style={styles.itemDetails}>
          <View style={styles.itemNameWrap}>
            <Text
              style={[
                type.label,
                { color: C.textPrimary, flexShrink: 1 },
                item.isChecked && { textDecorationLine: 'line-through', color: C.textSecondary },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {!!item.quantity && (
              <View style={[styles.itemQty, { backgroundColor: C.secondary }]}>
                <Text style={[type.caption, { color: C.secondaryForeground, fontWeight: '700' }]}>
                  {hasCount ? `x${qtyNum}` : item.quantity}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.itemActions}>
            {isDuplicate && (
              <View
                style={[
                  styles.duplicateBadge,
                  { backgroundColor: C.warning + '24', borderColor: C.warning + '55' },
                ]}
              >
                <Text style={[type.caption, { color: C.warning, fontWeight: '700' }]}>on list</Text>
              </View>
            )}
            {isPrivate ? (
              <Ionicons name="lock-closed" size={14} color={C.primary} />
            ) : (
              <UserAvatar userId={item.addedBy} size={22} />
            )}
            {canEdit && (
              <>
                <Pressable
                  onPress={startEdit}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                >
                  <Ionicons name="pencil-outline" size={15} color={C.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                >
                  <Ionicons name="trash-outline" size={17} color={C.textSecondary} />
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function CtrBtn({
  onPress,
  disabled,
  symbol,
  C,
}: {
  onPress: () => void;
  disabled: boolean;
  symbol: string;
  C: ColorTokens;
}): React.JSX.Element {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        style={{
          minWidth: 44,
          minHeight: 44,
          borderRadius: 22,
          backgroundColor: C.surfaceSecondary,
          borderWidth: 1,
          borderColor: C.border,
          justifyContent: 'center',
          alignItems: 'center',
          opacity: disabled ? 0.3 : 1,
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.primary, lineHeight: 20 }}>
          {symbol}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
interface GroceryItemWithMeta extends GroceryItem {
  isDuplicate?: boolean;
}
interface SectionData {
  title: string;
  icon: string;
  data: GroceryItemWithMeta[];
  sectionType: 'draft' | 'private' | 'shared';
}

export default function GroceryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeStyle = useFadeInUp(0);

  const markSeen = useBadgeStore((s) => s.markSeen);
  useFocusEffect(
    useCallback((): void => {
      markSeen('grocery').catch(() => {});
    }, [markSeen])
  );

  const isLoading = useGroceryStore((s) => s.isLoading);
  const error = useGroceryStore((s) => s.error);
  const items = useGroceryStore((s) => s.items);
  const addItem = useGroceryStore((s) => s.addItem);
  const updateItem = useGroceryStore((s) => s.updateItem);
  const toggleItem = useGroceryStore((s) => s.toggleItem);
  const incBought = useGroceryStore((s) => s.incrementBought);
  const decBought = useGroceryStore((s) => s.decrementBought);
  const deleteItem = useGroceryStore((s) => s.deleteItem);
  const clearChecked = useGroceryStore((s) => s.clearChecked);
  const publishDraftItems = useGroceryStore((s) => s.publishDraftItems);
  const activeRun = useGroceryStore((s) => s.activeRun);
  const startRun = useGroceryStore((s) => s.startRun);
  const endRun = useGroceryStore((s) => s.endRun);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const draftEnabled = useSettingsStore((s) => s.isEnabled('grocery_draft'));

  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('1');
  const [showCustomQty, setShowCustomQty] = useState(false);
  const [customQty, setCustomQty] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('draft');
  const [addError, setAddError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const inputRef = useRef<TextInput>(null);

  // Restore persisted add-mode preference
  useEffect((): void | (() => void) => {
    AsyncStorage.getItem(ADD_MODE_KEY)
      .then((v) => {
        if (v === 'shared' || v === 'draft' || v === 'private') {
          setAddMode(v === 'draft' && !draftEnabled ? 'shared' : v);
        }
      })
      .catch(() => {});
  }, [draftEnabled]);

  const resolvedQty = showCustomQty ? customQty : qty;
  const effectiveMode: AddMode = !draftEnabled && addMode === 'draft' ? 'shared' : addMode;

  const checked = useMemo(() => items.filter((i) => i.isChecked), [items]);

  const sections = useMemo((): SectionData[] => {
    const draftItems = items.filter((i) => i.isDraft && i.addedBy === myId);
    const privateItems = items.filter((i) => i.isPersonal && !i.isDraft && i.addedBy === myId);
    const sharedItems = items.filter((i) => !i.isPersonal);

    const sharedNames = new Set(sharedItems.map((i) => i.name.toLowerCase().trim()));

    const result: SectionData[] = [];

    if (draftItems.length > 0) {
      result.push({
        title: 'My Draft',
        icon: '📝',
        sectionType: 'draft',
        data: draftItems.map((i) => ({
          ...i,
          isDuplicate: sharedNames.has(i.name.toLowerCase().trim()),
        })),
      });
    }

    if (privateItems.length > 0) {
      result.push({
        title: 'My Private List',
        icon: '🔒',
        sectionType: 'private',
        data: privateItems,
      });
    }

    const firstIndex = new Map<string, number>();
    const map = new Map<string, SectionData>();
    for (let i = 0; i < sharedItems.length; i++) {
      const item = sharedItems[i];
      const cat = detectCategory(item.name);
      if (!map.has(cat.label)) {
        map.set(cat.label, { title: cat.label, icon: cat.icon, sectionType: 'shared', data: [] });
        firstIndex.set(cat.label, i);
      }
      map.get(cat.label)!.data.push(item);
    }
    result.push(
      ...Array.from(map.values()).sort(
        (a, b) => (firstIndex.get(a.title) ?? 99) - (firstIndex.get(b.title) ?? 99)
      )
    );

    return result;
  }, [items, myId]);

  const handleAdd = useCallback(
    async (quick?: string): Promise<void> => {
      const n = quick ?? itemName.trim();
      if (!n || isAdding) return;
      setIsAdding(true);
      setAddError(null);
      try {
        await addItem(n, quick ? '' : resolvedQty, myId, houseId ?? '', effectiveMode);
        setItemName('');
        setQty('1');
        setCustomQty('');
        setShowCustomQty(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setTimeout(() => inputRef.current?.focus(), 50);
      } catch {
        setAddError('Could not add the item. Please try again.');
      } finally {
        setIsAdding(false);
      }
    },
    [itemName, resolvedQty, myId, houseId, addItem, isAdding, effectiveMode]
  );

  const handleStartRun = useCallback(async (): Promise<void> => {
    try {
      await startRun(myId, myName);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setAddError('Could not start shopping run. Please try again.');
    }
  }, [startRun, myId, myName]);

  const handleEndRun = useCallback(async (): Promise<void> => {
    try {
      await endRun();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      setAddError('Could not end shopping run. Please try again.');
    }
  }, [endRun]);

  const onToggle = useCallback(
    (id: string): void => {
      toggleItem(id);
    },
    [toggleItem]
  );
  const onDelete = useCallback(
    (id: string): void => {
      deleteItem(id);
    },
    [deleteItem]
  );
  const onInc = useCallback(
    (id: string): void => {
      incBought(id);
    },
    [incBought]
  );
  const onDec = useCallback(
    (id: string): void => {
      decBought(id);
    },
    [decBought]
  );
  const onUpdate = useCallback(
    (id: string, name: string, quantity: string): Promise<void> => updateItem(id, name, quantity),
    [updateItem]
  );
  const handleClear = useCallback((): void => {
    clearChecked(houseId ?? '');
  }, [clearChecked, houseId]);

  const handlePublishDraft = useCallback(async (): Promise<void> => {
    if (isPublishing || !myId) return;
    setIsPublishing(true);
    setAddError(null);
    try {
      await publishDraftItems(myId, houseId ?? '');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setAddError(
        err instanceof Error ? err.message : 'Could not share your list. Please try again.'
      );
    } finally {
      setIsPublishing(false);
    }
  }, [publishDraftItems, myId, houseId, isPublishing]);

  // Header card handlers
  const handleSetMode = useCallback(
    (mode: AddMode): void => {
      const safe: AddMode = mode === 'draft' && !draftEnabled ? 'shared' : mode;
      setAddMode(safe);
      AsyncStorage.setItem(ADD_MODE_KEY, safe).catch(() => {});
    },
    [draftEnabled]
  );
  const handleSetShared = useCallback(
    (): void => handleSetMode(addMode === 'shared' ? 'draft' : 'shared'),
    [addMode, handleSetMode]
  );
  const handleSetPrivate = useCallback(
    (): void => handleSetMode(addMode === 'private' ? 'draft' : 'private'),
    [addMode, handleSetMode]
  );
  const handleItemNameChange = useCallback((v: string): void => {
    setItemName(v);
    setAddError(null);
  }, []);
  const handleAddPress = useCallback((): void => {
    handleAdd();
  }, [handleAdd]);
  const handleQtyPresetSelect = useCallback((p: string): void => {
    setShowCustomQty(false);
    setQty(p);
  }, []);
  const handleToggleCustomQty = useCallback((): void => {
    setShowCustomQty(true);
    setQty('');
  }, []);
  const handleQuickAdd = useCallback(
    (name: string): void => {
      Haptics.selectionAsync().catch(() => {});
      handleAdd(name);
    },
    [handleAdd]
  );

  const renderItem = useCallback(
    ({ item }: { item: GroceryItemWithMeta }): React.JSX.Element => (
      <ItemRow
        item={item}
        myId={myId}
        isDuplicate={item.isDuplicate}
        onToggle={onToggle}
        onDelete={onDelete}
        onIncrement={onInc}
        onDecrement={onDec}
        onUpdate={onUpdate}
        C={C}
      />
    ),
    [myId, onToggle, onDelete, onInc, onDec, onUpdate, C]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }): React.JSX.Element => {
      if (section.sectionType === 'draft') {
        const doneDisabled = isPublishing || !myId;
        return (
          <View style={styles.catTitleDraftRow}>
            <View style={[styles.catTitle, { flex: 1 }]}>
              <Text style={styles.catTitleIcon}>{section.icon}</Text>
              <Text style={[type.label, { color: C.warning }]}>{section.title}</Text>
            </View>
            <Pressable
              style={[styles.draftPublishBtn, doneDisabled && { opacity: 0.35 }]}
              onPress={handlePublishDraft}
              disabled={doneDisabled}
              accessibilityRole="button"
              accessibilityLabel="Share draft with housemates"
            >
              {isPublishing ? (
                <ActivityIndicator size="small" color={C.warning} />
              ) : (
                <Ionicons name="checkmark-circle" size={26} color={C.warning} />
              )}
            </Pressable>
          </View>
        );
      }
      if (section.sectionType === 'private') {
        return (
          <View
            style={[
              styles.catTitle,
              {
                backgroundColor: C.accent,
                borderRadius: 8,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: C.primary + '35',
              },
            ]}
          >
            <Text style={styles.catTitleIcon}>{section.icon}</Text>
            <Text style={[type.label, { color: C.primary }]}>{section.title}</Text>
          </View>
        );
      }
      return (
        <View style={styles.catTitle}>
          <Text style={styles.catTitleIcon}>{section.icon}</Text>
          <Text style={[type.label, { color: C.textPrimary }]}>{section.title}</Text>
        </View>
      );
    },
    [handlePublishDraft, isPublishing, myId, styles, C]
  );

  const isMyRun = !!activeRun && activeRun.shopperId === myId;

  // ── Shopping run card (footer) ──────────────────────────────────────────
  const ShoppingRunCard = (): React.JSX.Element => {
    if (activeRun && isMyRun) {
      return (
        <View
          style={[
            styles.shoppingRunCard,
            { backgroundColor: C.positive + '14', borderColor: C.positive + '40' },
          ]}
        >
          <View style={[styles.shoppingIcon, { backgroundColor: '#fff' }]}>
            <Text style={{ fontSize: 26 }}>🛍️</Text>
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={[type.subtitle, { color: C.textPrimary, textAlign: 'center' }]}>
              {"You're at the store"}
            </Text>
            <Text style={[type.bodySm, { color: C.textSecondary, textAlign: 'center' }]}>
              {elapsedLabel(activeRun.startedAt)} · Housemates can see the list
            </Text>
          </View>
          <Button variant="danger" onPress={handleEndRun} fullWidth size="md">
            Done Shopping
          </Button>
        </View>
      );
    }

    if (activeRun && !isMyRun) {
      return (
        <View
          style={[
            styles.shoppingRunCard,
            { backgroundColor: C.positive + '14', borderColor: C.positive + '40' },
          ]}
        >
          <View style={[styles.shoppingIcon, { backgroundColor: '#fff' }]}>
            <Text style={{ fontSize: 26 }}>🛍️</Text>
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={[type.subtitle, { color: C.textPrimary, textAlign: 'center' }]}>
              {activeRun.shopperName} is at the store!
            </Text>
            <Text style={[type.bodySm, { color: C.textSecondary, textAlign: 'center' }]}>
              {"Add last-minute items — they'll see the list update live"}
            </Text>
          </View>
          <View style={[styles.shopperBadge, { backgroundColor: C.surface }]}>
            <UserAvatar userId={activeRun.shopperId} size={28} />
            <Text style={[type.labelSm, { color: C.textPrimary }]}>
              {elapsedLabel(activeRun.startedAt)}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.shoppingRunCard,
          { backgroundColor: C.accent, borderColor: C.primary + '35' },
        ]}
      >
        <View style={[styles.shoppingIcon, { backgroundColor: '#fff' }]}>
          <Text style={{ fontSize: 26 }}>🛍️</Text>
        </View>
        <View style={styles.shoppingCopy}>
          <Text style={[type.subtitle, { color: C.textPrimary, textAlign: 'center' }]}>
            Start a Shopping Run
          </Text>
          <Text style={[type.bodySm, { color: C.textSecondary, textAlign: 'center' }]}>
            {"Let your housemates know you're at the store so they can add last-minute items."}
          </Text>
        </View>
        <Button variant="primary" onPress={handleStartRun} fullWidth size="md">
          {"I'm going shopping"}
        </Button>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header title="Groceries" />
        <Animated.View style={[styles.flex, fadeStyle]}>
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListHeaderComponent={
              <View>
                {/* ── Blue hero with add input ─────────────────────────── */}
                <View style={styles.heroCard}>
                  <View style={styles.heroDeco} />
                  <View style={styles.heroDecoSm} />

                  <View style={styles.heroTopRow}>
                    <View style={styles.heroIcon}>
                      <Ionicons name="cart-outline" size={26} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.eyebrow, { color: 'rgba(255,255,255,0.78)' }]}>
                        House list
                      </Text>
                      <Text style={[type.title, { color: '#fff' }]}>Shared Groceries</Text>
                    </View>
                  </View>

                  <Text style={[type.bodySm, { color: 'rgba(255,255,255,0.78)' }]}>
                    Add things as you run out. Tick them off at the store.
                  </Text>

                  {/* Mode toggle */}
                  <View style={styles.modeToggle}>
                    <ModeBtn
                      label="🏠 Shared"
                      active={effectiveMode === 'shared'}
                      onPress={handleSetShared}
                      activeBg="#fff"
                      activeColor={C.primary}
                      inactiveBg="rgba(255,255,255,0.14)"
                      inactiveColor="rgba(255,255,255,0.85)"
                    />
                    <ModeBtn
                      label="🔒 Private"
                      active={effectiveMode === 'private'}
                      onPress={handleSetPrivate}
                      activeBg="rgba(255,255,255,0.96)"
                      activeColor="rgb(124,58,237)"
                      inactiveBg="rgba(255,255,255,0.14)"
                      inactiveColor="rgba(255,255,255,0.85)"
                    />
                  </View>
                  {draftEnabled && effectiveMode === 'draft' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="pencil-outline" size={12} color="rgba(255,255,255,0.7)" />
                      <Text style={[type.caption, { color: 'rgba(255,255,255,0.7)' }]}>
                        Saves to your draft
                      </Text>
                    </View>
                  )}

                  {/* Add row */}
                  {!!addError && (
                    <View
                      style={[styles.errorBanner, { backgroundColor: 'rgba(255,255,255,0.16)' }]}
                    >
                      <Text style={[type.bodySm, { color: '#fff' }]}>{addError}</Text>
                    </View>
                  )}
                  <View style={[styles.addRow, { backgroundColor: '#fff' }]}>
                    <TextInput
                      ref={inputRef}
                      value={itemName}
                      onChangeText={handleItemNameChange}
                      placeholder={t('grocery.item_placeholder')}
                      placeholderTextColor={C.textSecondary}
                      style={[styles.addInput, { color: C.textPrimary }]}
                      returnKeyType="done"
                      blurOnSubmit={false}
                      onSubmitEditing={handleAddPress}
                      accessibilityRole="search"
                      accessibilityLabel="Add item name"
                    />
                    <AddInline
                      disabled={!itemName.trim() || isAdding}
                      onPress={handleAddPress}
                      bg={C.primary}
                    />
                  </View>

                  {/* Qty selector */}
                  <View style={styles.qtyRow}>
                    <Text style={[type.captionMed, { color: 'rgba(255,255,255,0.85)' }]}>Qty</Text>
                    <View style={styles.qtyPresets}>
                      {QTY_PRESETS.map((p) => (
                        <QtyChip
                          key={p}
                          label={p}
                          active={!showCustomQty && qty === p}
                          onPress={() => handleQtyPresetSelect(p)}
                        />
                      ))}
                      <QtyChip label="✏️" active={showCustomQty} onPress={handleToggleCustomQty} />
                    </View>
                    {showCustomQty && (
                      <TextInput
                        value={customQty}
                        onChangeText={setCustomQty}
                        placeholder="e.g. 6"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        keyboardType="number-pad"
                        style={styles.formQty}
                        autoFocus
                      />
                    )}
                  </View>

                  {/* Quick add */}
                  <View>
                    <Text
                      style={[type.eyebrow, { color: 'rgba(255,255,255,0.78)', marginBottom: 8 }]}
                    >
                      Quick Add
                    </Text>
                    <View style={styles.quickAdds}>
                      {QUICK_ADDS.map((qa) => (
                        <QuickChip key={qa} label={qa} onPress={() => handleQuickAdd(qa)} />
                      ))}
                    </View>
                  </View>
                </View>

                {isLoading && items.length === 0 && (
                  <ActivityIndicator
                    size="small"
                    color={C.primary}
                    style={{ marginVertical: 12 }}
                  />
                )}
                {!!error && (
                  <View
                    style={[styles.errorBanner, { backgroundColor: C.danger + '14', marginTop: 8 }]}
                  >
                    <Text style={[type.bodySm, { color: C.danger }]}>{error}</Text>
                  </View>
                )}

                {/* Clear checked bar */}
                {checked.length > 0 && (
                  <Pressable
                    style={[
                      styles.clearBar,
                      { backgroundColor: C.positive + '14', borderColor: C.positive + '35' },
                    ]}
                    onPress={handleClear}
                    accessibilityRole="button"
                    accessibilityLabel={`Clear ${checked.length} checked items`}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-done-outline" size={16} color={C.positive} />
                      <Text style={[type.labelSm, { color: C.positive }]}>
                        {t('grocery.checked_count', { count: checked.length })}
                      </Text>
                    </View>
                    <Text style={[type.labelSm, { color: C.positive }]}>
                      {t('grocery.clear_checked')}
                    </Text>
                  </Pressable>
                )}
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                icon="cart-outline"
                title={t('grocery.empty')}
                message={t('grocery.empty_hint')}
              />
            }
            ListFooterComponent={
              <View style={{ gap: 20, marginTop: 8 }}>
                <ShoppingRunCard />
                <View style={{ height: sizes.bottomTabContentPadding }} />
              </View>
            }
          />
        </Animated.View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ── Mini sub-components ─────────────────────────────────────────────────────
function ModeBtn({
  label,
  active,
  onPress,
  activeBg,
  activeColor,
  inactiveBg,
  inactiveColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeBg: string;
  activeColor: string;
  inactiveBg: string;
  inactiveColor: string;
}): React.JSX.Element {
  const press = usePressScale(0.96);
  return (
    <Animated.View style={[{ flex: 1 }, press.animatedStyle]}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          flex: 1,
          minHeight: 44,
          borderRadius: 10,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: active ? activeBg : inactiveBg,
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[type.labelSm, { color: active ? activeColor : inactiveColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function QtyChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Quantity ${label}`}
        accessibilityState={{ selected: active }}
        style={{
          minWidth: 36,
          height: 36,
          borderRadius: 9999,
          paddingHorizontal: 10,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.18)',
        }}
        hitSlop={4}
      >
        <Text style={[type.labelSm, { color: active ? '#1A3578' : '#fff' }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function QuickChip({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  const press = usePressScale(0.94);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          paddingVertical: 7,
          paddingHorizontal: 12,
          backgroundColor: 'rgba(255,255,255,0.18)',
          borderRadius: 9999,
        }}
        accessibilityRole="button"
        accessibilityLabel={`Add ${label}`}
      >
        <Text style={[type.labelSm, { color: '#fff' }]}>+ {label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function AddInline({
  disabled,
  onPress,
  bg,
}: {
  disabled: boolean;
  onPress: () => void;
  bg: string;
}): React.JSX.Element {
  const press = usePressScale(0.9);
  return (
    <Animated.View style={press.animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        disabled={disabled}
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: disabled ? '#94a3b8' : bg,
        }}
        accessibilityRole="button"
        accessibilityLabel="Add item"
      >
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff', lineHeight: 26 }}>+</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  const isDark = C.background !== '#F6F2EA';
  return StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1, backgroundColor: C.background },
    listContent: { paddingHorizontal: sizes.md, paddingTop: 4, paddingBottom: 8 },

    // Blue hero
    heroCard: {
      backgroundColor: C.primary,
      borderRadius: sizes.borderRadiusLg,
      padding: sizes.lg,
      gap: 14,
      marginBottom: sizes.md,
      position: 'relative',
      overflow: 'hidden',
    },
    heroDeco: {
      position: 'absolute',
      top: -40,
      right: -30,
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },
    heroDecoSm: {
      position: 'absolute',
      bottom: -50,
      left: -20,
      width: 110,
      height: 110,
      borderRadius: 55,
      backgroundColor: 'rgba(255,255,255,0.05)',
    },
    heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: sizes.sm },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.16)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Mode toggle
    modeToggle: { flexDirection: 'row', gap: 8 },

    // Inline add row
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 12,
      paddingHorizontal: 4,
      paddingVertical: 4,
      minHeight: 52,
    },
    addInput: { flex: 1, paddingHorizontal: 12, fontSize: 15 },

    // Qty selector
    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    qtyPresets: { flexDirection: 'row', gap: 6 },
    formQty: {
      flex: 1,
      height: 36,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderRadius: 10,
      paddingHorizontal: 10,
      fontSize: 15,
      color: '#fff',
      textAlign: 'center',
    },

    // Quick add
    quickAdds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

    // Section header
    catTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 4,
      paddingTop: 12,
      paddingBottom: 4,
    },
    catTitleDraftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      paddingBottom: 4,
      gap: 8,
    },
    catTitleIcon: { fontSize: 16 },
    draftPublishBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    // Grocery item
    groceryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      ...(isDark
        ? {}
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: 1,
          }),
    } as never,
    duplicateBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
    },

    itemDetails: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minWidth: 0,
    },
    itemNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
    itemQty: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
    itemActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
    iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    // Edit mode
    editNameInput: {
      flex: 1,
      height: 44,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 15,
    },
    editQtyInput: {
      width: 60,
      height: 44,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 14,
      textAlign: 'center',
    },
    editActionBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    counter: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },

    // Banners
    errorBanner: { borderRadius: 10, padding: 12 },

    // Clear bar
    clearBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 44,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
    },

    // Shopping run card
    shoppingRunCard: {
      paddingVertical: 24,
      paddingHorizontal: 20,
      borderRadius: 20,
      borderWidth: 1,
      alignItems: 'center',
      gap: 14,
      ...(isDark
        ? {}
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 6,
            elevation: 1,
          }),
    } as never,
    shoppingIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
    shoppingCopy: { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
    shopperBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 9999,
    },
  });
}
