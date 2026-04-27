import { useState, useCallback, useMemo, useRef } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useGroceryStore, type GroceryItem } from '@stores/groceryStore';
import { useAuthStore } from '@stores/authStore';
import { useHousematesStore } from '@stores/housematesStore';
import { colors } from '@constants/colors';
import { font } from '@constants/typography';

// ── Banani design tokens ────────────────────────────────────────────────────────
const SURFACE_BG   = 'rgba(251,248,245,0.96)';
const SHOP_CARD_BG = 'rgba(239,246,255,0.9)';
const SHOP_BORDER  = 'rgba(191,219,254,0.7)';
const SHOP_ACTIVE_BG  = 'rgba(235,255,240,0.95)';
const SHOP_ACTIVE_BORDER = 'rgba(140,210,160,0.7)';
const PERSONAL_BG  = 'rgba(245,240,255,0.6)';
const PERSONAL_BORDER = 'rgba(167,139,250,0.35)';

const QUICK_ADDS = ['Milk', 'Bread', 'Trash Bags', 'Coffee', 'Butter', 'Olive Oil'];
const QTY_PRESETS = ['1', '2', '3'];

// ── Category detection ─────────────────────────────────────────────────────────
interface Category { label: string; icon: string; order: number }

const RULES: Array<{ re: RegExp; cat: Category }> = [
  { re: /banana|apple|avocado|tomato|carrot|onion|lettuce|orange|strawberry|grape|cucumber|pepper|lime|lemon|herb|spinach|broccoli|salad/i,
    cat: { label: 'Produce', icon: '🍎', order: 0 } },
  { re: /milk|oat milk|almond milk|egg|cheese|butter|yogurt|cream|dairy/i,
    cat: { label: 'Dairy & Fridge', icon: '🥛', order: 1 } },
  { re: /toilet|soap|trash|bin bag|sponge|paper towel|dish|laundry|detergent|bleach|towel|cleaning/i,
    cat: { label: 'Household', icon: '🧺', order: 2 } },
  { re: /chicken|beef|fish|salmon|tuna|pork|lamb|shrimp|sausage|meat|mince/i,
    cat: { label: 'Meat & Fish', icon: '🥩', order: 3 } },
  { re: /pasta|rice|bread|flour|sugar|salt|olive oil|oil|cereal|oats|coffee|tea|sauce|can|tin/i,
    cat: { label: 'Pantry', icon: '🥫', order: 4 } },
];
const OTHER_CAT: Category = { label: 'Other', icon: '📦', order: 99 };

function detectCategory(name: string): Category {
  return RULES.find((r) => r.re.test(name))?.cat ?? OTHER_CAT;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarUrl ? 'transparent' : avatarColor(displayName) }]}>
      {avatarUrl
        ? <Image source={{ uri: avatarUrl }} style={{ width: size, height: size }} contentFit="cover" />
        : <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.44) }]}>{displayName[0].toUpperCase()}</Text>
      }
    </View>
  );
}

// ── Item row ───────────────────────────────────────────────────────────────────
interface ItemRowProps {
  item: GroceryItem;
  myId: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onUpdate: (id: string, name: string, quantity: string) => Promise<void>;
}

function ItemRow({ item, myId, onToggle, onDelete, onIncrement, onDecrement, onUpdate }: ItemRowProps): React.JSX.Element {
  const qtyNum    = parseInt(item.quantity, 10);
  const hasCount  = !isNaN(qtyNum) && qtyNum > 1;
  const bought    = item.boughtCount ?? 0;
  const canEdit   = item.addedBy === myId;

  const [isEditing, setIsEditing]   = useState(false);
  const [editName, setEditName]     = useState(item.name);
  const [editQty, setEditQty]       = useState(item.quantity);
  const [isSaving, setIsSaving]     = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const handleTap = useCallback((): void => {
    if (!hasCount) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
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

  const handleEditNameChange = useCallback((v: string): void => {
    setEditName(v);
    setSaveError(null);
  }, []);

  const handleEditQtyChange = useCallback((v: string): void => {
    setEditQty(v);
    setSaveError(null);
  }, []);

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

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (isEditing) {
    return (
      <View>
        <View style={[styles.groceryItem, styles.groceryItemEditing]}>
          <TextInput
            value={editName}
            onChangeText={handleEditNameChange}
            style={styles.editNameInput}
            autoFocus
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder="Item name"
            placeholderTextColor={colors.textSecondary}
            accessible
            accessibilityRole="text"
            accessibilityLabel="Item name, edit"
            accessibilityHint="Type a new name for this item"
          />
          <TextInput
            value={editQty}
            onChangeText={handleEditQtyChange}
            style={styles.editQtyInput}
            keyboardType="default"
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder="Qty"
            placeholderTextColor={colors.textSecondary}
            accessible
            accessibilityRole="text"
            accessibilityLabel="Quantity, edit"
            accessibilityHint="Type a new quantity"
          />
          <Pressable onPress={saveEdit} style={styles.editActionBtn} accessibilityRole="button" accessibilityLabel="Save changes">
            <Ionicons name="checkmark" size={20} color={colors.positive} />
          </Pressable>
          <Pressable onPress={cancelEdit} style={styles.editActionBtn} accessibilityRole="button" accessibilityLabel="Cancel edit">
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
        {!!saveError && (
          <Text style={styles.inlineError}>{saveError}</Text>
        )}
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.groceryItem, item.isChecked && styles.groceryItemDone, item.isPersonal && styles.groceryItemPersonal]}
      onPress={handleTap}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.isChecked }}
      accessibilityLabel={item.name}
    >
      {hasCount ? (
        <View style={styles.counter}>
          <Pressable
            accessible
            onPress={handleDecrement}
            style={[styles.ctrBtn, bought === 0 && styles.ctrBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${item.name}`}
            accessibilityState={{ disabled: bought === 0 }}
          >
            <Text style={styles.ctrBtnText}>−</Text>
          </Pressable>
          <Text style={styles.ctrText}>{bought}/{qtyNum}</Text>
          <Pressable
            accessible
            onPress={handleIncrement}
            style={[styles.ctrBtn, bought >= qtyNum && styles.ctrBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${item.name}`}
            accessibilityState={{ disabled: bought >= qtyNum }}
          >
            <Text style={styles.ctrBtnText}>+</Text>
          </Pressable>
        </View>
      ) : (
        <Ionicons
          name={item.isChecked ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={item.isChecked ? colors.positive : colors.border}
        />
      )}
      <View style={styles.itemDetails}>
        <View style={styles.itemNameWrap}>
          <Text style={[styles.itemName, item.isChecked && styles.itemNameDone]} numberOfLines={1}>
            {item.name}
          </Text>
          {!!item.quantity && (
            <View style={styles.itemQty}>
              <Text style={styles.itemQtyText}>{hasCount ? `x${qtyNum}` : item.quantity}</Text>
            </View>
          )}
        </View>
        <View style={styles.itemActions}>
          {item.isPersonal
            ? <Ionicons name="lock-closed" size={14} color="rgba(139,92,246,0.6)" />
            : <UserAvatar userId={item.addedBy} size={22} />
          }
          {canEdit && (
            <Pressable
              onPress={startEdit}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
            >
              <Ionicons name="pencil-outline" size={15} color={colors.textSecondary} />
            </Pressable>
          )}
          {canEdit && (
            <Pressable
              onPress={handleDelete}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}
            >
              <Ionicons name="trash-outline" size={17} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
interface SectionData { title: string; icon: string; data: GroceryItem[]; isPersonal?: boolean }

export default function GroceryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const isLoading    = useGroceryStore((s) => s.isLoading);
  const error        = useGroceryStore((s) => s.error);
  const items        = useGroceryStore((s) => s.items);
  const addItem      = useGroceryStore((s) => s.addItem);
  const updateItem   = useGroceryStore((s) => s.updateItem);
  const toggleItem   = useGroceryStore((s) => s.toggleItem);
  const incBought    = useGroceryStore((s) => s.incrementBought);
  const decBought    = useGroceryStore((s) => s.decrementBought);
  const deleteItem   = useGroceryStore((s) => s.deleteItem);
  const clearChecked = useGroceryStore((s) => s.clearChecked);
  const activeRun    = useGroceryStore((s) => s.activeRun);
  const startRun     = useGroceryStore((s) => s.startRun);
  const endRun       = useGroceryStore((s) => s.endRun);
  const profile      = useAuthStore((s) => s.profile);
  const houseId      = useAuthStore((s) => s.houseId);
  const myId         = profile?.id ?? '';
  const myName       = profile?.name ?? '';

  const [itemName, setItemName]           = useState('');
  const [qty, setQty]                     = useState('1');
  const [showCustomQty, setShowCustomQty] = useState(false);
  const [customQty, setCustomQty]         = useState('');
  const [isAdding, setIsAdding]           = useState(false);
  const [isPersonal, setIsPersonal]       = useState(false);
  const [addError, setAddError]           = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);

  const resolvedQty = showCustomQty ? customQty : qty;

  const checked = useMemo(() => items.filter((i) => i.isChecked), [items]);

  const sections = useMemo((): SectionData[] => {
    const personalItems = items.filter((i) => i.isPersonal);
    const sharedItems   = items.filter((i) => !i.isPersonal);

    const result: SectionData[] = [];

    if (personalItems.length > 0) {
      result.push({ title: 'My Private List', icon: '🔒', data: personalItems, isPersonal: true });
    }

    // firstIndex records when each category first appears in the newest-first items array.
    // Sections are sorted by this so the most recently touched category floats to the top.
    const firstIndex = new Map<string, number>();
    const map = new Map<string, SectionData>();
    for (let i = 0; i < sharedItems.length; i++) {
      const item = sharedItems[i];
      const cat = detectCategory(item.name);
      if (!map.has(cat.label)) {
        map.set(cat.label, { title: cat.label, icon: cat.icon, data: [], isPersonal: false });
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
  }, [items]);

  const handleAdd = useCallback(async (quick?: string): Promise<void> => {
    const n = quick ?? itemName.trim();
    if (!n || isAdding) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await addItem(n, quick ? '' : resolvedQty, myId, houseId ?? '', isPersonal);
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
  }, [itemName, resolvedQty, myId, houseId, addItem, isAdding, isPersonal]);

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

  const onToggle    = useCallback((id: string): void => { toggleItem(id); }, [toggleItem]);
  const onDelete    = useCallback((id: string): void => { deleteItem(id); }, [deleteItem]);
  const onInc       = useCallback((id: string): void => { incBought(id); }, [incBought]);
  const onDec       = useCallback((id: string): void => { decBought(id); }, [decBought]);
  const onUpdate    = useCallback((id: string, name: string, quantity: string): Promise<void> => updateItem(id, name, quantity), [updateItem]);
  const handleClear = useCallback((): void => { clearChecked(houseId ?? ''); }, [clearChecked, houseId]);

  // ── Stable header-card handlers ────────────────────────────────────────────
  const handleSetShared       = useCallback((): void => setIsPersonal(false), []);
  const handleSetPrivate      = useCallback((): void => setIsPersonal(true), []);
  const handleItemNameChange  = useCallback((v: string): void => { setItemName(v); setAddError(null); }, []);
  const handleAddPress        = useCallback((): void => { handleAdd(); }, [handleAdd]);
  const handleQtyPresetSelect = useCallback((p: string): void => { setShowCustomQty(false); setQty(p); }, []);
  const handleToggleCustomQty = useCallback((): void => { setShowCustomQty(true); setQty(''); }, []);
  const handleQuickAdd        = useCallback((name: string): void => {
    Haptics.selectionAsync().catch(() => {});
    handleAdd(name);
  }, [handleAdd]);

  const renderItem = useCallback(
    ({ item }: { item: GroceryItem }): React.JSX.Element => (
      <ItemRow
        item={item}
        myId={myId}
        onToggle={onToggle}
        onDelete={onDelete}
        onIncrement={onInc}
        onDecrement={onDec}
        onUpdate={onUpdate}
      />
    ),
    [myId, onToggle, onDelete, onInc, onDec, onUpdate]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }): React.JSX.Element => (
      <View style={[styles.catTitle, section.isPersonal && styles.catTitlePersonal]}>
        <Text style={styles.catTitleIcon}>{section.icon}</Text>
        <Text style={[styles.catTitleText, section.isPersonal && styles.catTitleTextPersonal]}>
          {section.title}
        </Text>
      </View>
    ),
    []
  );

  const isMyRun = !!activeRun && activeRun.shopperId === myId;

  // ── Shopping run card ───────────────────────────────────────────────────────
  const ShoppingRunCard = (): React.JSX.Element => {
    if (activeRun && isMyRun) {
      return (
        <View style={[styles.shoppingRunCard, styles.shoppingRunCardActive]}>
          <View style={[styles.shoppingIcon, styles.shoppingIconActive]}>
            <Text style={styles.shoppingIconText}>🛍️</Text>
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={styles.titleLg}>{"You're at the store"}</Text>
            <Text style={styles.textSm}>{elapsedLabel(activeRun.startedAt)} · Housemates can see the list</Text>
          </View>
          <Pressable style={[styles.btnPrimary, styles.btnFull, styles.btnDanger]} onPress={handleEndRun} accessibilityRole="button">
            <Text style={styles.btnPrimaryText}>Done Shopping</Text>
          </Pressable>
        </View>
      );
    }

    if (activeRun && !isMyRun) {
      return (
        <View style={[styles.shoppingRunCard, styles.shoppingRunCardActive]}>
          <View style={[styles.shoppingIcon, styles.shoppingIconActive]}>
            <Text style={styles.shoppingIconText}>🛍️</Text>
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={styles.titleLg}>{activeRun.shopperName} is at the store!</Text>
            <Text style={styles.textSm}>{"Add last-minute items — they'll see the list update live"}</Text>
          </View>
          <View style={styles.shopperBadge}>
            <UserAvatar userId={activeRun.shopperId} size={28} />
            <Text style={styles.shopperBadgeText}>{elapsedLabel(activeRun.startedAt)}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.shoppingRunCard}>
        <View style={styles.shoppingIcon}>
          <Text style={styles.shoppingIconText}>🛍️</Text>
        </View>
        <View style={styles.shoppingCopy}>
          <Text style={styles.titleLg}>Start a Shopping Run</Text>
          <Text style={styles.textSm}>
            {"Let your housemates know you're at the store so they can add last-minute items."}
          </Text>
        </View>
        <Pressable style={[styles.btnPrimary, styles.btnFull]} onPress={handleStartRun} accessibilityRole="button">
          <Text style={styles.btnPrimaryText}>{"I'm going shopping"}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.itemSep} />}
          SectionSeparatorComponent={() => <View style={styles.sectionSep} />}

          ListHeaderComponent={
            <View>
              {/* ── Hero card ─────────────────────────────────────────────── */}
              <View style={styles.headerCard}>
                <View style={styles.headerCopy}>
                  <Text style={styles.titleHero}>Shared Groceries</Text>
                  <Text style={styles.textBase}>
                    Add things as you run out. Tick them off at the store.
                  </Text>
                </View>

                {/* ── Shared / Personal toggle ─────────────────────────── */}
                <View style={styles.modeToggle}>
                  <Pressable
                    style={[styles.modeBtn, !isPersonal && styles.modeBtnOn]}
                    onPress={handleSetShared}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !isPersonal }}
                  >
                    <Text style={[styles.modeBtnText, !isPersonal && styles.modeBtnTextOn]}>🏠 Shared</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modeBtn, isPersonal && styles.modeBtnPersonal]}
                    onPress={handleSetPrivate}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isPersonal }}
                  >
                    <Text style={[styles.modeBtnText, isPersonal && styles.modeBtnTextPersonal]}>🔒 Just me</Text>
                  </Pressable>
                </View>

                {/* ── Inline add input ────────────────────────────────── */}
                {!!addError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{addError}</Text>
                  </View>
                )}
                <View style={[styles.addRow, isPersonal && styles.addRowPersonal]}>
                  <TextInput
                    ref={inputRef}
                    value={itemName}
                    onChangeText={handleItemNameChange}
                    placeholder={t('grocery.item_placeholder')}
                    placeholderTextColor={colors.textSecondary}
                    style={styles.addInput}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={handleAddPress}
                    accessible
                    accessibilityRole="search"
                    accessibilityLabel="Add item name"
                    accessibilityHint="Type a grocery item and press the plus button or return to add it"
                  />
                  <Pressable
                    style={[styles.addBtn, (!itemName.trim() || isAdding) && styles.addBtnOff, isPersonal && styles.addBtnPersonal]}
                    onPress={handleAddPress}
                    disabled={!itemName.trim() || isAdding}
                    accessibilityRole="button"
                    accessibilityLabel="Add item"
                  >
                    <Text style={styles.addBtnText}>{isAdding ? '…' : '+'}</Text>
                  </Pressable>
                </View>

                {/* ── Qty selector ───────────────────────────────────── */}
                <View style={styles.qtyRow}>
                  <Text style={styles.qtyLabel}>Qty</Text>
                  <View style={styles.qtyPresets}>
                    {QTY_PRESETS.map((p) => {
                      const active = !showCustomQty && qty === p;
                      return (
                        <Pressable
                          key={p}
                          style={[styles.qtyBtn, active && styles.qtyBtnOn]}
                          onPress={() => handleQtyPresetSelect(p)}
                          hitSlop={4}
                        >
                          <Text style={[styles.qtyBtnText, active && styles.qtyBtnTextOn]}>{p}</Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      style={[styles.qtyBtn, showCustomQty && styles.qtyBtnOn]}
                      onPress={handleToggleCustomQty}
                      hitSlop={4}
                    >
                      <Text style={[styles.qtyBtnText, showCustomQty && styles.qtyBtnTextOn]}>✏️</Text>
                    </Pressable>
                  </View>
                  {showCustomQty && (
                    <TextInput
                      value={customQty}
                      onChangeText={setCustomQty}
                      placeholder="e.g. 6"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      style={styles.formQty}
                      autoFocus
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel="Custom quantity"
                      accessibilityHint="Enter the number of items to add, for example six"
                    />
                  )}
                </View>

                {/* ── Quick Add ──────────────────────────────────────── */}
                <View>
                  <Text style={[styles.eyebrow, styles.quickAddLabel]}>Quick Add</Text>
                  <View style={styles.quickAdds}>
                    {QUICK_ADDS.map((qa) => (
                      <Pressable
                        key={qa}
                        style={styles.quickAddBtn}
                        onPress={() => handleQuickAdd(qa)}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${qa}`}
                      >
                        <Text style={styles.quickAddText}>+ {qa}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* ── Load / error states ──────────────────────────────────── */}
              {isLoading && items.length === 0 && (
                <ActivityIndicator size="small" color="#4F78B6" style={styles.loadingIndicator} />
              )}
              {!!error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{error}</Text>
                </View>
              )}

              {/* ── Clear checked bar ────────────────────────────────────── */}
              {checked.length > 0 && (
                <Pressable
                  accessible
                  style={styles.clearBar}
                  onPress={handleClear}
                  accessibilityRole="button"
                  accessibilityLabel={`Clear ${checked.length} checked items`}
                  accessibilityState={{ disabled: false }}
                >
                  <View style={styles.clearBarLeft}>
                    <Ionicons name="checkmark-done-outline" size={16} color={colors.positive} />
                    <Text style={styles.clearBarCount}>{t('grocery.checked_count', { count: checked.length })}</Text>
                  </View>
                  <Text style={styles.clearBarAction}>{t('grocery.clear_checked')}</Text>
                </Pressable>
              )}
            </View>
          }

          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🛒</Text>
              <Text style={styles.emptyTitle}>{t('grocery.empty')}</Text>
              <Text style={styles.emptyText}>{t('grocery.empty_hint')}</Text>
            </View>
          }

          ListFooterComponent={
            <View style={styles.footer}>
              <ShoppingRunCard />
              <View style={styles.bottomPad} />
            </View>
          }
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:        { flex: 1 },
  container:   { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },

  // ── Hero card
  headerCard: {
    backgroundColor: SURFACE_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
    marginBottom: 24,
    boxShadow: '0 8px 24px rgba(44,51,61,0.05)',
  } as never,
  headerCopy: { gap: 6 },

  // Typography
  titleHero: { fontSize: 26, ...font.extrabold, color: colors.textPrimary, letterSpacing: -0.78, lineHeight: 31 },
  titleLg:   { fontSize: 18, ...font.bold, color: colors.textPrimary, letterSpacing: -0.36, textAlign: 'center' },
  textBase:  { fontSize: 15, ...font.regular, color: colors.textSecondary, lineHeight: 22 },
  textSm:    { fontSize: 13, ...font.regular, color: colors.textSecondary, lineHeight: 18, textAlign: 'center' },
  eyebrow:   { fontSize: 12, ...font.bold, color: colors.textSecondary, letterSpacing: 0.72, textTransform: 'uppercase' },

  // ── Shared / Personal toggle
  modeToggle: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1, minHeight: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  modeBtnOn:           { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnPersonal:     { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.4)' },
  modeBtnText:         { fontSize: 14, ...font.semibold, color: colors.textSecondary },
  modeBtnTextOn:       { color: '#FFFFFF' },
  modeBtnTextPersonal: { color: 'rgb(76,29,149)' },

  // ── Inline add row
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#FBFAF8', paddingRight: 6, paddingLeft: 4,
    height: 50,
  },
  addRowPersonal: { borderColor: 'rgba(139,92,246,0.4)', backgroundColor: 'rgba(245,240,255,0.6)' },
  addInput: {
    flex: 1, height: '100%', paddingHorizontal: 10,
    fontSize: 15, ...font.regular, color: colors.textPrimary,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primary,
    boxShadow: '0 4px 12px rgba(79,120,182,0.22)',
  } as never,
  addBtnOff:      { backgroundColor: colors.textDisabled, boxShadow: 'none' } as never,
  addBtnPersonal: { backgroundColor: 'rgb(124,58,237)' },
  addBtnText:     { fontSize: 22, ...font.bold, color: '#FFFFFF', lineHeight: 26 },

  // ── Primary button (shopping run)
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: colors.primary,
    boxShadow: '0 8px 16px rgba(79,120,182,0.18)',
  } as never,
  btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#FFFFFF' },
  btnFull:        { alignSelf: 'stretch' },
  btnDanger:      { backgroundColor: colors.danger, boxShadow: '0 8px 16px rgba(217,83,79,0.22)' } as never,

  // ── Qty selector
  qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  qtyLabel:   { fontSize: 13, ...font.semibold, color: colors.textSecondary },
  qtyPresets: { flexDirection: 'row', gap: 6 },
  qtyBtn: {
    minWidth: 36, height: 36, borderRadius: 9999, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 10, backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
  },
  qtyBtnOn:     { backgroundColor: colors.primary, borderColor: colors.primary },
  qtyBtnText:   { fontSize: 14, ...font.semibold, color: colors.textPrimary },
  qtyBtnTextOn: { color: '#FFFFFF' },
  formQty: {
    flex: 1, height: 36, backgroundColor: '#FBFAF8', borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10,
    fontSize: 15, ...font.regular, color: colors.textPrimary, textAlign: 'center',
  },

  // ── Quick add (inside header card)
  quickAddLabel: { marginBottom: 8 },
  quickAdds:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickAddBtn: {
    paddingVertical: 7, paddingHorizontal: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 9999, boxShadow: '0 2px 8px rgba(44,51,61,0.02)',
  } as never,
  quickAddText: { fontSize: 13, ...font.semibold, color: colors.textPrimary },

  // ── Section header
  catTitle:            { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
  catTitlePersonal:    { backgroundColor: PERSONAL_BG, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: PERSONAL_BORDER },
  catTitleIcon:        { fontSize: 15 },
  catTitleText:        { fontSize: 14, ...font.bold, color: colors.textPrimary },
  catTitleTextPersonal:{ color: 'rgb(109,40,217)' },

  // ── Grocery item
  groceryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    boxShadow: '0 4px 16px rgba(44,51,61,0.02)',
  } as never,
  groceryItemDone:     { opacity: 0.5, borderColor: 'transparent', boxShadow: 'none' } as never,
  groceryItemPersonal: { backgroundColor: 'rgba(245,240,255,0.7)', borderColor: 'rgba(139,92,246,0.2)' },
  groceryItemEditing:  { backgroundColor: '#FAFAF8', borderColor: colors.primary, gap: 8 },
  itemSep:             { height: 8 },
  sectionSep:          { height: 8 },

  itemDetails:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 0 },
  itemNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  itemName:     { fontSize: 15, ...font.semibold, color: colors.textPrimary, flexShrink: 1 },
  itemNameDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  itemQty:      { backgroundColor: colors.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
  itemQtyText:  { fontSize: 12, ...font.bold, color: colors.textSecondary },
  itemActions:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  editBtn:      { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  deleteBtn:    { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  // ── Inline edit mode
  editNameInput: {
    flex: 1, height: 44, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: '#FBFAF8', borderWidth: 1, borderColor: colors.primary,
    fontSize: 15, ...font.regular, color: colors.textPrimary,
  },
  editQtyInput: {
    width: 60, height: 44, paddingHorizontal: 8, borderRadius: 8,
    backgroundColor: '#FBFAF8', borderWidth: 1, borderColor: colors.border,
    fontSize: 14, ...font.regular, color: colors.textPrimary, textAlign: 'center',
  },
  editActionBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  inlineError:   { fontSize: 12, color: '#D94F4F', paddingTop: 4, paddingHorizontal: 4 },

  counter:    { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  ctrBtn:     { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  ctrBtnOff:  { opacity: 0.3 },
  ctrBtnText: { fontSize: 16, ...font.bold, color: colors.primary, lineHeight: 20 },
  ctrText:    { fontSize: 14, ...font.bold, color: colors.textPrimary, minWidth: 32, textAlign: 'center' },

  avatar:     { justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  avatarText: { color: '#FFFFFF', ...font.bold },

  loadingIndicator: { marginBottom: 8 },
  errorBanner: {
    backgroundColor: '#FFF0F0', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  errorBannerText: { fontSize: 13, color: '#D94F4F' },

  emptyWrap:  { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon:  { fontSize: 44 },
  emptyTitle: { fontSize: 16, ...font.bold, color: colors.textPrimary },
  emptyText:  { fontSize: 14, ...font.regular, color: colors.textSecondary, textAlign: 'center' },

  // ── Clear checked bar
  clearBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 44,
    borderRadius: 12, marginBottom: 12,
    backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  clearBarLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearBarCount:  { fontSize: 14, ...font.semibold, color: colors.positive },
  clearBarAction: { fontSize: 13, ...font.semibold, color: colors.positive },

  // ── Footer
  footer: { gap: 20 },

  // ── Shopping run card
  shoppingRunCard: {
    paddingVertical: 24, paddingHorizontal: 20, borderRadius: 20,
    backgroundColor: SHOP_CARD_BG, borderWidth: 1, borderColor: SHOP_BORDER,
    alignItems: 'center', gap: 14,
    boxShadow: '0 12px 32px rgba(44,51,61,0.04)',
  } as never,
  shoppingRunCardActive: { backgroundColor: SHOP_ACTIVE_BG, borderColor: SHOP_ACTIVE_BORDER },
  shoppingIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 8px 20px rgba(44,51,61,0.06)',
  } as never,
  shoppingIconActive: { backgroundColor: 'rgba(220,255,230,0.9)' },
  shoppingIconText: { fontSize: 26 },
  shoppingCopy:     { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  shopperBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  shopperBadgeText: { fontSize: 13, ...font.semibold, color: colors.textPrimary },

  bottomPad: { height: 40 },
});
