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
  Animated,
  BackHandler,
  Switch,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGroceryStore, type GroceryItem, type AddMode, type GroceryList } from '@stores/groceryStore';
import { useAuthStore } from '@stores/authStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { UserAvatar } from '@components/shared/UserAvatar';
import { GroceryItemDetailModal } from '@components/grocery/GroceryItemDetailModal';
import { SaveListModal, type SaveListMode } from '@components/grocery/SaveListModal';
import { LeaveWithoutShareModal } from '@components/grocery/LeaveWithoutShareModal';
import { SavedListsSection } from '@components/grocery/SavedListsSection';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';

// ── Accent constants ───────────────────────────────────────────────────────────
const SHOP_BORDER        = 'rgba(191,219,254,0.7)';
const SHOP_ACTIVE_BORDER = 'rgba(140,210,160,0.7)';
const PERSONAL_BG        = 'rgba(124,58,237,0.08)';
const PERSONAL_BORDER    = 'rgba(167,139,250,0.35)';

const ADD_MODE_KEY = 'grocery_add_mode';
const DRAFT_TOGGLE_KEY = 'grocery_draft_toggle';

const QUICK_ADDS = ['Milk', 'Bread', 'Trash Bags', 'Coffee', 'Butter', 'Olive Oil'];
const QTY_PRESETS = ['1', '2', '3'];
const UNIT_OPTS = ['ml', 'L', 'g', 'kg'] as const;

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

function elapsedLabel(startedAt: string): string {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 1) return 'Just started';
  if (mins < 60) return `${mins} min at the store`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m at the store`;
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
  onLongPress: (item: GroceryItem) => void;
}

function ItemRow({ item, myId, isDuplicate = false, onToggle, onDelete, onIncrement, onDecrement, onUpdate, onLongPress }: ItemRowProps): React.JSX.Element {
  const C = useThemedColors();
  const isPlainInt = /^\d+$/.test(item.quantity.trim());
  const qtyNum     = isPlainInt ? parseInt(item.quantity, 10) : NaN;
  const hasCount   = isPlainInt && qtyNum > 1;
  const bought    = item.boughtCount ?? 0;
  const canEdit   = item.addedBy === myId;

  const [isEditing, setIsEditing]   = useState(false);
  const [editName, setEditName]     = useState(item.name);
  const [editQty, setEditQty]       = useState(item.quantity);
  const [isSaving, setIsSaving]     = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const rowStyles = useMemo(() => makeStyles(C), [C]);

  const handleTap = useCallback((): void => {
    if (!hasCount) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }
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

  const handleEditNameChange = useCallback((v: string): void => { setEditName(v); setSaveError(null); }, []);
  const handleEditQtyChange  = useCallback((v: string): void => { setEditQty(v); setSaveError(null); }, []);

  const startEdit = useCallback((): void => {
    setEditName(item.name); setEditQty(item.quantity); setSaveError(null); setIsEditing(true);
  }, [item.name, item.quantity]);

  const cancelEdit = useCallback((): void => { setSaveError(null); setIsEditing(false); }, []);

  const handleLongPress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onLongPress(item);
  }, [item, onLongPress]);

  const saveEdit = useCallback(async (): Promise<void> => {
    const trimmed = editName.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true); setSaveError(null);
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
      <View>
        <View style={[rowStyles.groceryItem, rowStyles.groceryItemEditing]}>
          <TextInput
            value={editName} onChangeText={handleEditNameChange} style={rowStyles.editNameInput}
            autoFocus returnKeyType="done" blurOnSubmit={false} onSubmitEditing={saveEdit}
            placeholder="Item name" placeholderTextColor={C.textSecondary}
            accessible accessibilityRole="text" accessibilityLabel="Item name, edit"
          />
          <TextInput
            value={editQty} onChangeText={handleEditQtyChange} style={rowStyles.editQtyInput}
            keyboardType="default" returnKeyType="done" blurOnSubmit={false} onSubmitEditing={saveEdit}
            placeholder="Qty" placeholderTextColor={C.textSecondary}
            accessible accessibilityRole="text" accessibilityLabel="Quantity, edit"
          />
          <Pressable onPress={saveEdit} style={rowStyles.editActionBtn} accessibilityRole="button" accessibilityLabel="Save changes">
            <Ionicons name="checkmark" size={20} color={C.positive} />
          </Pressable>
          <Pressable onPress={cancelEdit} style={rowStyles.editActionBtn} accessibilityRole="button" accessibilityLabel="Cancel edit">
            <Ionicons name="close" size={20} color={C.textSecondary} />
          </Pressable>
        </View>
        {!!saveError && <Text style={rowStyles.inlineError}>{saveError}</Text>}
      </View>
    );
  }

  return (
    <Pressable
      style={[rowStyles.groceryItem, item.isChecked && rowStyles.groceryItemDone, item.isPersonal && !item.isDraft && rowStyles.groceryItemPersonal]}
      onPress={handleTap} onLongPress={handleLongPress} delayLongPress={400}
      accessibilityRole="checkbox" accessibilityState={{ checked: item.isChecked }}
      accessibilityLabel={isDuplicate ? `${item.name}, already on shared list` : item.name}
      accessibilityHint="Long press for details and notes"
    >
      {hasCount ? (
        <View style={rowStyles.counter}>
          <Pressable accessible onPress={handleDecrement} style={[rowStyles.ctrBtn, bought === 0 && rowStyles.ctrBtnOff]}
            accessibilityRole="button" accessibilityLabel={`Decrease ${item.name}`} accessibilityState={{ disabled: bought === 0 }}>
            <Text style={rowStyles.ctrBtnText}>−</Text>
          </Pressable>
          <Text style={rowStyles.ctrText}>{bought}/{qtyNum}</Text>
          <Pressable accessible onPress={handleIncrement} style={[rowStyles.ctrBtn, bought >= qtyNum && rowStyles.ctrBtnOff]}
            accessibilityRole="button" accessibilityLabel={`Increase ${item.name}`} accessibilityState={{ disabled: bought >= qtyNum }}>
            <Text style={rowStyles.ctrBtnText}>+</Text>
          </Pressable>
        </View>
      ) : (
        <Ionicons name={item.isChecked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={item.isChecked ? C.positive : C.border} />
      )}
      <View style={rowStyles.itemDetails}>
        <View style={rowStyles.itemNameWrap}>
          <Text style={[rowStyles.itemName, item.isChecked && rowStyles.itemNameDone]}>{item.name}</Text>
          {!!item.quantity && (
            <View style={rowStyles.itemQty}>
              <Text style={rowStyles.itemQtyText}>{hasCount ? `x${qtyNum}` : item.quantity}</Text>
            </View>
          )}
        </View>
        <View style={rowStyles.itemActions}>
          {isDuplicate && (
            <View style={rowStyles.duplicateBadge} accessibilityLabel="Already on shared list">
              <Text style={rowStyles.duplicateBadgeText}>⚠️ on list</Text>
            </View>
          )}
          {!!item.comment && <Ionicons name="chatbubble-ellipses-outline" size={14} color={C.textSecondary} accessibilityLabel="Has a note" />}
          {item.isPersonal && !item.isDraft
            ? <Ionicons name="lock-closed" size={14} color="rgba(139,92,246,0.6)" />
            : <UserAvatar userId={item.addedBy} size={22} />
          }
          {canEdit && (
            <Pressable onPress={startEdit} style={rowStyles.editBtn} accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`}>
              <Ionicons name="pencil-outline" size={15} color={C.textSecondary} />
            </Pressable>
          )}
          {canEdit && (
            <Pressable onPress={handleDelete} style={rowStyles.deleteBtn} accessibilityRole="button" accessibilityLabel={`Delete ${item.name}`}>
              <Ionicons name="trash-outline" size={17} color={C.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function ItemSeparator(): React.JSX.Element {
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(C), [C]);
  return <View style={s.itemSep} />;
}
function SectionSeparator(): React.JSX.Element {
  const C = useThemedColors();
  const s = useMemo(() => makeStyles(C), [C]);
  return <View style={s.sectionSep} />;
}

// ── Screen ─────────────────────────────────────────────────────────────────────
interface GroceryItemWithMeta extends GroceryItem { isDuplicate?: boolean }
interface SectionData { title: string; icon: string; data: GroceryItemWithMeta[]; sectionType: 'draft' | 'private' | 'shared' }

export default function GroceryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

  const isLoading              = useGroceryStore((s) => s.isLoading);
  const error                  = useGroceryStore((s) => s.error);
  const items                  = useGroceryStore((s) => s.items);
  const addItem                = useGroceryStore((s) => s.addItem);
  const updateItem             = useGroceryStore((s) => s.updateItem);
  const toggleItem             = useGroceryStore((s) => s.toggleItem);
  const incBought              = useGroceryStore((s) => s.incrementBought);
  const decBought              = useGroceryStore((s) => s.decrementBought);
  const deleteItem             = useGroceryStore((s) => s.deleteItem);
  const clearChecked           = useGroceryStore((s) => s.clearChecked);
  const publishDraftItems      = useGroceryStore((s) => s.publishDraftItems);
  const addComment             = useGroceryStore((s) => s.addComment);
  const activeRun              = useGroceryStore((s) => s.activeRun);
  const startRun               = useGroceryStore((s) => s.startRun);
  const endRun                 = useGroceryStore((s) => s.endRun);
  const savedLists             = useGroceryStore((s) => s.savedLists);
  const isLoadingLists         = useGroceryStore((s) => s.isLoadingLists);
  const currentDraftSourceListId = useGroceryStore((s) => s.currentDraftSourceListId);
  const fetchSavedLists        = useGroceryStore((s) => s.fetchSavedLists);
  const createSavedList        = useGroceryStore((s) => s.createSavedList);
  const updateSavedList        = useGroceryStore((s) => s.updateSavedList);
  const deleteSavedList        = useGroceryStore((s) => s.deleteSavedList);
  const loadListIntoDraft      = useGroceryStore((s) => s.loadListIntoDraft);

  const profile      = useAuthStore((s) => s.profile);
  const houseId      = useAuthStore((s) => s.houseId);
  const myId         = profile?.id ?? '';
  const myName       = profile?.name ?? '';
  const draftEnabled = useSettingsStore((s) => s.isEnabled('grocery_draft'));

  const [itemName, setItemName]           = useState('');
  const [qty, setQty]                     = useState('1');
  const [showCustomQty, setShowCustomQty] = useState(false);
  const [customQty, setCustomQty]         = useState('');
  const [isAdding, setIsAdding]           = useState(false);
  const [addMode, setAddMode]             = useState<AddMode>('shared');
  const [isDraftOn, setIsDraftOn]         = useState(false);
  const [addError, setAddError]           = useState<string | null>(null);
  const [isPublishing, setIsPublishing]   = useState(false);
  const [unit, setUnit]                   = useState<string>('');
  const [selectedItem, setSelectedItem]   = useState<GroceryItem | null>(null);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [showSaveListModal, setShowSaveListModal] = useState(false);
  const [saveListMode, setSaveListMode]           = useState<SaveListMode>('new');
  const [pendingPublishedItems, setPendingPublishedItems] = useState<Array<{ name: string; quantity: string }>>([]);
  const [showLeaveModal, setShowLeaveModal]       = useState(false);
  const leaveWarningShownRef                      = useRef(false);

  const inputRef = useRef<TextInput>(null);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // Restore persisted add-mode preference. Depends on draftEnabled so it
  // re-applies correctly if the feature flag hydrates after mount.
  useEffect((): void => {
    Promise.all([
      AsyncStorage.getItem(ADD_MODE_KEY),
      AsyncStorage.getItem(DRAFT_TOGGLE_KEY),
    ]).then(([modeVal, draftVal]) => {
      if (modeVal === 'private') setAddMode('private');
      else if (modeVal === 'draft') {
        // Legacy migration: 'draft' stored value → shared + draft toggle ON
        setAddMode('shared');
        if (draftEnabled) setIsDraftOn(true);
      }
      // modeVal === 'shared' or null → default 'shared' already set
      if (draftVal === 'true' && draftEnabled) setIsDraftOn(true);
    }).catch((err) => {
      console.warn('Failed to restore grocery preferences', err);
    });
  }, [draftEnabled]);

  // Fetch saved lists on mount
  useEffect((): void => {
    if (houseId) { fetchSavedLists(houseId); }
  }, [houseId, fetchSavedLists]);

  // ── Leave-without-share detection ──────────────────────────────────────────
  const myDraftItems = useMemo(
    () => items.filter((i) => i.isDraft && i.addedBy === myId),
    [items, myId]
  );

  // Keep a ref in sync so the focus effect never needs myDraftItems as a dep
  const myDraftItemsRef = useRef(myDraftItems);
  useEffect((): void => {
    myDraftItemsRef.current = myDraftItems;
  }, [myDraftItems]);

  // Reset warning flag when draft becomes empty (after sharing or manual delete)
  useEffect((): void => {
    if (myDraftItems.length === 0) { leaveWarningShownRef.current = false; }
  }, [myDraftItems.length]);

  // Show warning ONLY when the screen actually loses focus (not on re-renders)
  useFocusEffect(
    useCallback(() => {
      return (): void => {
        if (myDraftItemsRef.current.length > 0 && !leaveWarningShownRef.current) {
          leaveWarningShownRef.current = true;
          setShowLeaveModal(true);
        }
      };
    }, []) // Empty deps — callback never recreated, cleanup runs only on real blur
  );

  // Android hardware back button — same logic
  useEffect((): (() => void) => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (myDraftItems.length > 0 && !leaveWarningShownRef.current) {
        leaveWarningShownRef.current = true;
        setShowLeaveModal(true);
        return true; // prevent default back
      }
      return false;
    });
    return (): void => sub.remove();
  }, [myDraftItems]);

  const resolvedQty = (showCustomQty ? customQty : qty) + unit;
  const effectiveMode: AddMode = addMode === 'private' ? 'private' : (draftEnabled && isDraftOn ? 'draft' : 'shared');
  const checked = useMemo(() => items.filter((i) => i.isChecked), [items]);

  const sections = useMemo((): SectionData[] => {
    const draftItems   = items.filter((i) => i.isDraft    && i.addedBy === myId);
    const privateItems = items.filter((i) => i.isPersonal && !i.isDraft && i.addedBy === myId);
    const sharedItems  = items.filter((i) => !i.isPersonal);
    const sharedNames  = new Set(sharedItems.map((i) => i.name.toLowerCase().trim()));
    const result: SectionData[] = [];

    if (draftItems.length > 0) {
      result.push({
        title: 'My Draft',
        icon: '📝',
        sectionType: 'draft',
        data: draftItems.map((i) => ({ ...i, isDuplicate: sharedNames.has(i.name.toLowerCase().trim()) })),
      });
    }
    if (privateItems.length > 0) {
      result.push({ title: 'My Private List', icon: '🔒', sectionType: 'private', data: privateItems });
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

  const handleAdd = useCallback(async (quick?: string): Promise<void> => {
    const n = quick ?? itemName.trim();
    if (!n || isAdding) return;
    setIsAdding(true); setAddError(null);
    try {
      await addItem(n, quick ? '' : resolvedQty, myId, houseId ?? '', effectiveMode);
      setItemName(''); setQty('1'); setCustomQty(''); setShowCustomQty(false); setUnit('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch {
      setAddError('Could not add the item. Please try again.');
    } finally {
      setIsAdding(false);
    }
  }, [itemName, resolvedQty, myId, houseId, addItem, isAdding, effectiveMode]);

  const handlePublishDraft = useCallback(async (): Promise<void> => {
    if (isPublishing || !myId || !houseId) return;

    // Capture draft items before publishing (needed to save as a list)
    const draftSnapshot = myDraftItems.map((i) => ({ name: i.name, quantity: i.quantity }));
    if (draftSnapshot.length === 0) return;

    setIsPublishing(true); setAddError(null);
    try {
      await publishDraftItems(myId, houseId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      leaveWarningShownRef.current = false;

      // Show save/update modal
      setPendingPublishedItems(draftSnapshot);
      if (currentDraftSourceListId) {
        setSaveListMode('update');
      } else {
        setSaveListMode('new');
      }
      setShowSaveListModal(true);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not share your list. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  }, [publishDraftItems, myId, houseId, isPublishing, myDraftItems, currentDraftSourceListId]);

  // ── Saved lists handlers ───────────────────────────────────────────────────
  const handleLoadList = useCallback(async (list: GroceryList): Promise<void> => {
    if (!houseId) return;
    try {
      await loadListIntoDraft(list, myId, houseId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setAddError('Could not load the list. Please try again.');
    }
  }, [loadListIntoDraft, myId, houseId]);

  const handleDeleteList = useCallback(async (listId: string): Promise<void> => {
    try {
      await deleteSavedList(listId);
    } catch {
      setAddError('Could not delete the list. Please try again.');
    }
  }, [deleteSavedList]);

  // ── Save list modal handlers ───────────────────────────────────────────────
  const handleSaveNew = useCallback(async (name: string, isPrivate: boolean): Promise<void> => {
    if (!houseId) return;
    await createSavedList(name, houseId, myId, pendingPublishedItems, isPrivate);
    setPendingPublishedItems([]);
  }, [createSavedList, houseId, myId, pendingPublishedItems]);

  const handleUpdateList = useCallback(async (): Promise<void> => {
    if (!currentDraftSourceListId) return;
    await updateSavedList(currentDraftSourceListId, pendingPublishedItems);
    setPendingPublishedItems([]);
  }, [updateSavedList, currentDraftSourceListId, pendingPublishedItems]);

  const handleSaveListSkip = useCallback((): void => {
    setPendingPublishedItems([]);
    setShowSaveListModal(false);
  }, []);

  const handleSaveListClose = useCallback((): void => {
    setPendingPublishedItems([]);
    setShowSaveListModal(false);
  }, []);

  // ── Leave modal handlers ───────────────────────────────────────────────────
  const handleLeave = useCallback((): void => {
    setShowLeaveModal(false);
  }, []);

  const handleStayAndShare = useCallback((): void => {
    setShowLeaveModal(false);
    leaveWarningShownRef.current = false;
    router.push('/(tabs)/grocery');
  }, [router]);

  // ── Shopping run handlers ──────────────────────────────────────────────────
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
  const handleLongPress  = useCallback((item: GroceryItem): void => { setSelectedItem(item); }, []);
  const handleCloseModal = useCallback((): void => { setSelectedItem(null); }, []);
  const onSaveComment    = useCallback((id: string, comment: string): Promise<void> => addComment(id, comment), [addComment]);

  // ── Mode controls ─────────────────────────────────────────────────────────
  const handleSetShared  = useCallback((): void => {
    const prev = addMode;
    setAddMode('shared');
    AsyncStorage.setItem(ADD_MODE_KEY, 'shared').catch(() => {
      setAddMode(prev);
      setAddError('Could not save your preference. Please try again.');
    });
  }, [addMode]);
  const handleSetPrivate = useCallback((): void => {
    const prev = addMode;
    setAddMode('private');
    AsyncStorage.setItem(ADD_MODE_KEY, 'private').catch(() => {
      setAddMode(prev);
      setAddError('Could not save your preference. Please try again.');
    });
  }, [addMode]);
  const handleToggleDraft = useCallback((value: boolean): void => {
    setIsDraftOn(value);
    AsyncStorage.setItem(DRAFT_TOGGLE_KEY, String(value)).catch(() => {
      setIsDraftOn(!value);
      setAddError('Could not save your preference. Please try again.');
    });
  }, []);

  const handleItemNameChange  = useCallback((v: string): void => { setItemName(v); setAddError(null); }, []);
  const handleAddPress        = useCallback((): void => { handleAdd(); }, [handleAdd]);
  const handleQtyPresetSelect = useCallback((p: string): void => { setShowCustomQty(false); setQty(p); }, []);
  const handleToggleCustomQty = useCallback((): void => { setShowCustomQty(true); setQty(''); }, []);
  const handleUnitToggle      = useCallback((u: string): void => { setUnit((prev) => (prev === u ? '' : u)); }, []);
  const handleQuickAdd        = useCallback((name: string): void => {
    Haptics.selectionAsync().catch(() => {});
    handleAdd(name);
  }, [handleAdd]);

  const renderItem = useCallback(
    ({ item }: { item: GroceryItemWithMeta }): React.JSX.Element => (
      <ItemRow
        item={item} myId={myId} isDuplicate={item.isDuplicate}
        onToggle={onToggle} onDelete={onDelete} onIncrement={onInc}
        onDecrement={onDec} onUpdate={onUpdate} onLongPress={handleLongPress}
      />
    ),
    [myId, onToggle, onDelete, onInc, onDec, onUpdate, handleLongPress]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }): React.JSX.Element => {
      if (section.sectionType === 'draft') {
        const doneDisabled = isPublishing || !myId;
        return (
          <View style={styles.catTitleDraftRow}>
            <View style={[styles.catTitle, styles.catTitleFlex]}>
              <Text style={styles.catTitleIcon}>{section.icon}</Text>
              <Text style={[styles.catTitleText, styles.catTitleTextDraft]}>{section.title}</Text>
            </View>
            <Pressable
              style={[styles.draftPublishBtn, doneDisabled && styles.draftPublishBtnOff]}
              onPress={handlePublishDraft} disabled={doneDisabled}
              accessible accessibilityRole="button"
              accessibilityState={{ disabled: doneDisabled }}
              accessibilityLabel="Share draft with housemates"
              accessibilityHint="Adds all draft items to the shared grocery list"
            >
              {isPublishing
                ? <ActivityIndicator size="small" color="rgb(133,77,14)" />
                : <Ionicons name="checkmark-circle" size={26} color="rgb(133,77,14)" />
              }
            </Pressable>
          </View>
        );
      }
      if (section.sectionType === 'private') {
        return (
          <View style={[styles.catTitle, styles.catTitlePersonal]}>
            <Text style={styles.catTitleIcon}>{section.icon}</Text>
            <Text style={[styles.catTitleText, styles.catTitleTextPersonal]}>{section.title}</Text>
          </View>
        );
      }
      return (
        <View style={styles.catTitle}>
          <Text style={styles.catTitleIcon}>{section.icon}</Text>
          <Text style={styles.catTitleText}>{section.title}</Text>
        </View>
      );
    },
    [handlePublishDraft, isPublishing, myId, styles]
  );

  const isMyRun = !!activeRun && activeRun.shopperId === myId;

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
          <Text style={styles.textSm}>{"Let your housemates know you're at the store so they can add last-minute items."}</Text>
        </View>
        <Pressable style={[styles.btnPrimary, styles.btnFull]} onPress={handleStartRun} accessibilityRole="button">
          <Text style={styles.btnPrimaryText}>{"I'm going shopping"}</Text>
        </Pressable>
      </View>
    );
  };

  // ── Saved list name for update modal ──────────────────────────────────────
  const sourceListName = useMemo(
    () => savedLists.find((l) => l.id === currentDraftSourceListId)?.name,
    [savedLists, currentDraftSourceListId]
  );

  return (
    <>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.root} edges={['top']}>
          <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={ItemSeparator}
              SectionSeparatorComponent={SectionSeparator}

              ListHeaderComponent={
                <View>
                  {/* ── Hero card ─────────────────────────────────────────── */}
                  <View style={styles.headerCard}>
                    <View style={styles.headerCopy}>
                      <Text style={styles.titleHero}>Shared Groceries</Text>
                      <Text style={styles.textBase}>Add things as you run out. Tick them off at the store.</Text>
                    </View>

                    {/* ── Add mode toggle: Shared | Private ────────────── */}
                    <View style={styles.modeToggle}>
                      <Pressable
                        style={[styles.modeBtn, addMode === 'shared' && styles.modeBtnOn]}
                        onPress={handleSetShared} accessibilityRole="button"
                        accessibilityState={{ selected: addMode === 'shared' }}
                      >
                        <Text style={[styles.modeBtnText, addMode === 'shared' && styles.modeBtnTextOn]}>🏠 Shared</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modeBtn, addMode === 'private' && styles.modeBtnPersonal]}
                        onPress={handleSetPrivate} accessibilityRole="button"
                        accessibilityState={{ selected: addMode === 'private' }}
                      >
                        <Text style={[styles.modeBtnText, addMode === 'private' && styles.modeBtnTextPersonal]}>🔒 Private</Text>
                      </Pressable>
                    </View>

                    {/* ── Draft mode toggle (Shared only) ──────────────── */}
                    {addMode !== 'private' && draftEnabled && (
                      <View
                        style={[styles.draftToggleRow, isDraftOn && styles.draftToggleRowOn]}
                        accessible={false}
                      >
                        <View style={styles.draftToggleInfo}>
                          <Ionicons name="create-outline" size={16} color={isDraftOn ? 'rgb(133,77,14)' : C.textSecondary} />
                          <View>
                            <Text style={[styles.draftToggleLabel, isDraftOn && styles.draftToggleLabelOn]}>Draft mode</Text>
                            <Text style={styles.draftToggleSub}>
                              {isDraftOn ? 'Items queue here — tap ✓ to share with everyone' : 'Items go straight to the shared list'}
                            </Text>
                          </View>
                        </View>
                        <Switch
                          value={isDraftOn}
                          onValueChange={handleToggleDraft}
                          trackColor={{ false: C.border, true: 'rgba(224,178,77,0.55)' }}
                          thumbColor={isDraftOn ? 'rgb(133,77,14)' : '#f4f3f4'}
                          ios_backgroundColor={C.border}
                          accessible
                          accessibilityRole="switch"
                          accessibilityState={{ checked: isDraftOn }}
                          accessibilityLabel="Draft mode"
                          accessibilityHint="When on, added items queue in a draft list you can review before sharing"
                        />
                      </View>
                    )}

                    {/* ── Error banner ──────────────────────────────────── */}
                    {!!addError && (
                      <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{addError}</Text>
                      </View>
                    )}

                    {/* ── Inline add input ──────────────────────────────── */}
                    <View style={[styles.addRow, effectiveMode === 'private' && styles.addRowPersonal]}>
                      <TextInput
                        ref={inputRef} value={itemName} onChangeText={handleItemNameChange}
                        placeholder={t('grocery.item_placeholder')} placeholderTextColor={C.textSecondary}
                        style={styles.addInput} returnKeyType="done" blurOnSubmit={false}
                        onSubmitEditing={handleAddPress}
                        accessible accessibilityRole="search" accessibilityLabel="Add item name"
                      />
                      <Pressable
                        style={[styles.addBtn, (!itemName.trim() || isAdding) && styles.addBtnOff, effectiveMode === 'private' && styles.addBtnPersonal]}
                        onPress={handleAddPress} disabled={!itemName.trim() || isAdding}
                        accessibilityRole="button" accessibilityLabel="Add item"
                      >
                        <Text style={styles.addBtnText}>{isAdding ? '…' : '+'}</Text>
                      </Pressable>
                    </View>

                    {/* ── Qty selector ─────────────────────────────────── */}
                    <View style={styles.qtyRow}>
                      <Text style={styles.qtyLabel}>Qty</Text>
                      <View style={styles.qtyPresets}>
                        {QTY_PRESETS.map((p) => {
                          const active = !showCustomQty && qty === p;
                          return (
                            <Pressable key={p} style={[styles.qtyBtn, active && styles.qtyBtnOn]}
                              onPress={() => handleQtyPresetSelect(p)} hitSlop={4}>
                              <Text style={[styles.qtyBtnText, active && styles.qtyBtnTextOn]}>{p}</Text>
                            </Pressable>
                          );
                        })}
                        <Pressable style={[styles.qtyBtn, showCustomQty && styles.qtyBtnOn]}
                          onPress={handleToggleCustomQty} hitSlop={4}>
                          <Text style={[styles.qtyBtnText, showCustomQty && styles.qtyBtnTextOn]}>✏️</Text>
                        </Pressable>
                      </View>
                      {showCustomQty && (
                        <TextInput value={customQty} onChangeText={setCustomQty} placeholder="e.g. 6"
                          placeholderTextColor={C.textSecondary} keyboardType="number-pad" style={styles.formQty} autoFocus
                          accessible accessibilityRole="text" accessibilityLabel="Custom quantity"
                        />
                      )}
                    </View>

                    {/* ── Unit selector ────────────────────────────────── */}
                    <View style={styles.qtyRow}>
                      <Text style={styles.qtyLabel}>Unit</Text>
                      <View style={styles.qtyPresets}>
                        {UNIT_OPTS.map((u) => {
                          const active = unit === u;
                          return (
                            <Pressable key={u} style={[styles.qtyBtn, active && styles.qtyBtnOn]}
                              onPress={() => handleUnitToggle(u)} hitSlop={4}
                              accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Unit ${u}`}>
                              <Text style={[styles.qtyBtnText, active && styles.qtyBtnTextOn]}>{u}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>

                    {/* ── Quick Add (to current mode) ───────────────────── */}
                    <View>
                      <Text style={[styles.eyebrow, styles.quickAddLabel]}>Quick Add</Text>
                      <View style={styles.quickAdds}>
                        {QUICK_ADDS.map((qa) => (
                          <Pressable key={qa} style={styles.quickAddBtn} onPress={() => handleQuickAdd(qa)}
                            accessibilityRole="button" accessibilityLabel={`Add ${qa}`}>
                            <Text style={styles.quickAddText}>+ {qa}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* ── Saved Lists section ──────────────────────────────────── */}
                  <SavedListsSection
                    lists={savedLists}
                    isLoading={isLoadingLists}
                    myId={myId}
                    hasDraftItems={myDraftItems.length > 0}
                    onLoadList={handleLoadList}
                    onDeleteList={handleDeleteList}
                  />

                  {/* ── Load / error states ─────────────────────────────────── */}
                  {isLoading && items.length === 0 && (
                    <ActivityIndicator size="small" color="#4F78B6" style={styles.loadingIndicator} />
                  )}
                  {!!error && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorBannerText}>{error}</Text>
                    </View>
                  )}

                  {/* ── Clear checked bar ───────────────────────────────────── */}
                  {checked.length > 0 && (
                    <Pressable accessible style={styles.clearBar} onPress={handleClear}
                      accessibilityRole="button" accessibilityLabel={`Clear ${checked.length} checked items`}>
                      <View style={styles.clearBarLeft}>
                        <Ionicons name="checkmark-done-outline" size={16} color={C.positive} />
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
          </Animated.View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <GroceryItemDetailModal
        item={selectedItem} visible={!!selectedItem}
        myId={myId} onClose={handleCloseModal} onSaveComment={onSaveComment}
      />

      <SaveListModal
        visible={showSaveListModal}
        mode={saveListMode}
        existingListName={sourceListName}
        onSaveNew={handleSaveNew}
        onUpdate={handleUpdateList}
        onSkip={handleSaveListSkip}
        onClose={handleSaveListClose}
      />

      <LeaveWithoutShareModal
        visible={showLeaveModal}
        draftCount={myDraftItems.length}
        onLeave={handleLeave}
        onStayAndShare={handleStayAndShare}
      />
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  const successSubtle = C.success + '12';
  return StyleSheet.create({
    flex:        { flex: 1 },
    root:        { flex: 1, backgroundColor: C.background },
    listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },

    headerCard: {
      backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border,
      padding: 20, gap: 16, marginBottom: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    headerCopy: { gap: 6 },

    titleHero: { fontSize: 26, ...font.extrabold, color: C.textPrimary, letterSpacing: -0.78, lineHeight: 31 },
    titleLg:   { fontSize: 18, ...font.bold, color: C.textPrimary, letterSpacing: -0.36, textAlign: 'center' },
    textBase:  { fontSize: 15, ...font.regular, color: C.textSecondary, lineHeight: 22 },
    textSm:    { fontSize: 13, ...font.regular, color: C.textSecondary, lineHeight: 18, textAlign: 'center' },
    eyebrow:   { fontSize: 12, ...font.bold, color: C.textSecondary, letterSpacing: 0.72, textTransform: 'uppercase' },

    modeToggle:           { flexDirection: 'row', gap: 6 },
    modeBtn:              { flex: 1, minHeight: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border },
    modeBtnOn:            { backgroundColor: C.primary, borderColor: C.primary },
    modeBtnDraft:         { backgroundColor: 'rgba(224,178,77,0.15)', borderColor: 'rgba(224,178,77,0.55)' },
    modeBtnPersonal:      { backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.4)' },
    modeBtnText:          { fontSize: 13, ...font.semibold, color: C.textSecondary },
    modeBtnTextOn:        { color: '#FFFFFF' },
    modeBtnTextPersonal:  { color: 'rgb(76,29,149)' },

    // ── Draft mode toggle row
    draftToggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 12, minHeight: 52,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.surfaceSecondary, gap: 12,
    },
    draftToggleRowOn: {
      borderColor: 'rgba(224,178,77,0.55)',
      backgroundColor: 'rgba(224,178,77,0.08)',
    },
    draftToggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    draftToggleLabel: { fontSize: 14, ...font.semibold, color: C.textPrimary },
    draftToggleLabelOn: { color: 'rgb(133,77,14)' },
    draftToggleSub: { fontSize: 12, ...font.regular, color: C.textSecondary, marginTop: 1 },

    addRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      backgroundColor: C.surfaceSecondary, paddingRight: 6, paddingLeft: 4, height: 50,
    },
    addRowPersonal: { borderColor: PERSONAL_BORDER, backgroundColor: PERSONAL_BG },
    addInput: {
      flex: 1, height: '100%', paddingHorizontal: 10,
      fontSize: 15, ...font.regular, color: C.textPrimary,
    },
    addBtn: {
      width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
      backgroundColor: C.primary,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    addBtnOff:      { backgroundColor: C.textDisabled },
    addBtnPersonal: { backgroundColor: 'rgb(124,58,237)' },
    addBtnText:     { fontSize: 22, ...font.bold, color: '#FFFFFF', lineHeight: 26 },

    btnPrimary: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      minHeight: 48, paddingHorizontal: 18, borderRadius: 10, backgroundColor: C.primary,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    btnPrimaryText: { fontSize: 15, ...font.semibold, color: '#FFFFFF' },
    btnFull:        { alignSelf: 'stretch' },
    btnDanger:      { backgroundColor: C.danger },

    qtyRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    qtyLabel:   { fontSize: 13, ...font.semibold, color: C.textSecondary },
    qtyPresets: { flexDirection: 'row', gap: 6 },
    qtyBtn: {
      minWidth: 36, height: 36, borderRadius: 9999, justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 10, backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border,
    },
    qtyBtnOn:     { backgroundColor: C.primary, borderColor: C.primary },
    qtyBtnText:   { fontSize: 14, ...font.semibold, color: C.textPrimary },
    qtyBtnTextOn: { color: '#FFFFFF' },
    formQty: {
      flex: 1, height: 36, backgroundColor: C.surfaceSecondary, borderRadius: 10,
      borderWidth: 1, borderColor: C.border, paddingHorizontal: 10,
      fontSize: 15, ...font.regular, color: C.textPrimary, textAlign: 'center',
    },

    quickAddLabel: { marginBottom: 8 },
    quickAdds:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    quickAddBtn: {
      paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.border, borderRadius: 9999,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    quickAddText: { fontSize: 13, ...font.semibold, color: C.textPrimary },

    catTitle:             { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 },
    catTitlePersonal:     { backgroundColor: PERSONAL_BG, borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: PERSONAL_BORDER },
    catTitleDraftRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 4, gap: 8 },
    catTitleFlex:         { flex: 1 },
    catTitleIcon:         { fontSize: 15 },
    catTitleText:         { fontSize: 14, ...font.bold, color: C.textPrimary },
    catTitleTextDraft:    { color: 'rgb(133,77,14)' },
    catTitleTextPersonal: { color: 'rgb(76,29,149)' },

    draftPublishBtn:    { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    draftPublishBtnOff: { opacity: 0.35 },

    groceryItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    groceryItemDone:     { opacity: 0.5, borderColor: 'transparent' },
    groceryItemPersonal: { backgroundColor: PERSONAL_BG, borderColor: PERSONAL_BORDER },
    groceryItemEditing:  { backgroundColor: C.surface, borderColor: C.primary, gap: 8 },

    duplicateBadge: {
      backgroundColor: 'rgba(234,179,8,0.15)', borderRadius: 6,
      paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(234,179,8,0.4)',
    },
    duplicateBadgeText: { fontSize: 11, ...font.semibold, color: 'rgb(133,77,14)' },
    itemSep:             { height: 8 },
    sectionSep:          { height: 8 },

    itemDetails:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 0 },
    itemNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
    itemName:     { fontSize: 15, ...font.semibold, color: C.textPrimary, flexShrink: 1 },
    itemNameDone: { textDecorationLine: 'line-through', color: C.textSecondary },
    itemQty:      { backgroundColor: C.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 },
    itemQtyText:  { fontSize: 12, ...font.bold, color: C.textSecondary },
    itemActions:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
    editBtn:      { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    deleteBtn:    { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    editNameInput: {
      flex: 1, height: 44, paddingHorizontal: 10, borderRadius: 8,
      backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.primary,
      fontSize: 15, ...font.regular, color: C.textPrimary,
    },
    editQtyInput: {
      width: 60, height: 44, paddingHorizontal: 8, borderRadius: 8,
      backgroundColor: C.surfaceSecondary, borderWidth: 1, borderColor: C.border,
      fontSize: 14, ...font.regular, color: C.textPrimary, textAlign: 'center',
    },
    editActionBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    inlineError:   { fontSize: 12, color: '#D94F4F', paddingTop: 4, paddingHorizontal: 4 },

    counter:    { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
    ctrBtn:     { minWidth: 44, minHeight: 44, borderRadius: 22, backgroundColor: C.surfaceSecondary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
    ctrBtnOff:  { opacity: 0.3 },
    ctrBtnText: { fontSize: 16, ...font.bold, color: C.primary, lineHeight: 20 },
    ctrText:    { fontSize: 14, ...font.bold, color: C.textPrimary, minWidth: 32, textAlign: 'center' },

    avatar:     { justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    avatarText: { color: '#FFFFFF', ...font.bold },

    loadingIndicator: { marginBottom: 8 },
    errorBanner: { backgroundColor: '#FFF0F0', borderRadius: 10, padding: 12, marginBottom: 8 },
    errorBannerText: { fontSize: 13, color: '#D94F4F' },

    emptyWrap:  { alignItems: 'center', paddingVertical: 48, gap: 8 },
    emptyIcon:  { fontSize: 44 },
    emptyTitle: { fontSize: 16, ...font.bold, color: C.textPrimary },
    emptyText:  { fontSize: 14, ...font.regular, color: C.textSecondary, textAlign: 'center' },

    clearBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 12, minHeight: 44,
      borderRadius: 12, marginBottom: 12,
      backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
    },
    clearBarLeft:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    clearBarCount:  { fontSize: 14, ...font.semibold, color: C.positive },
    clearBarAction: { fontSize: 13, ...font.semibold, color: C.positive },

    footer: { gap: 20 },

    shoppingRunCard: {
      paddingVertical: 24, paddingHorizontal: 20, borderRadius: 20,
      backgroundColor: C.surface, borderWidth: 1, borderColor: SHOP_BORDER,
      alignItems: 'center', gap: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    shoppingRunCardActive: { backgroundColor: successSubtle, borderColor: SHOP_ACTIVE_BORDER },
    shoppingIcon: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    },
    shoppingIconActive: { backgroundColor: 'rgba(220,255,230,0.9)' },
    shoppingIconText: { fontSize: 26 },
    shoppingCopy:     { alignItems: 'center', gap: 4, paddingHorizontal: 8 },
    shopperBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
    shopperBadgeText: { fontSize: 13, ...font.semibold, color: C.textPrimary },

    bottomPad: { height: sizes.bottomTabContentPadding },
  });
}
