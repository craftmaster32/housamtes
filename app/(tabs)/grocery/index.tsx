import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import { useFeatureGuard } from '@hooks/useFeatureGuard';
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SectionList,
  ActivityIndicator,
  BackHandler,
  Animated,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { navigateToBase } from '@stores/navigationStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from '@lib/alert';
import {
  useGroceryStore,
  type GroceryItem,
  type AddMode,
  type GroceryList,
  type SavedListItem,
} from '@stores/groceryStore';
import { useAuthStore } from '@stores/authStore';
import { useBadgeStore } from '@stores/badgeStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useThemedColors, darkColors, type ColorTokens } from '@constants/colors';
import { useLanguageStore } from '@stores/languageStore';
import { UserAvatar } from '@components/shared/UserAvatar';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { BackLink } from '@components/shared/BackLink';
import { GroceryItemDetailModal } from '@components/grocery/GroceryItemDetailModal';
import { SaveListModal, type SaveListMode } from '@components/grocery/SaveListModal';
import {
  GroceryListEditorModal,
  type ListEditorMode,
} from '@components/grocery/GroceryListEditorModal';
import { LeaveWithoutShareModal } from '@components/grocery/LeaveWithoutShareModal';
import { SavedListsSection } from '@components/grocery/SavedListsSection';
import { GroceryReminderModal } from '@components/grocery/GroceryReminderModal';
import { ReminderPromptBanner } from '@components/grocery/ReminderPromptBanner';
import { useAddedItemPrompt } from '@hooks/useAddedItemPrompt';
import { useTween } from '@hooks/useTween';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { getErrorMessage } from '@utils/errors';
import { useHeadingFont } from '@hooks/useHeadingFont';
import type { IoniconName } from '@/types/icons';

import { mf, ms } from '@utils/responsive';
// ── Accent constants ───────────────────────────────────────────────────────────
const SHOP_BORDER = 'rgba(191,219,254,0.7)';
const SHOP_ACTIVE_BORDER = 'rgba(140,210,160,0.7)';
const PERSONAL_BG = 'rgba(124,58,237,0.08)';
const PERSONAL_BORDER = 'rgba(167,139,250,0.35)';

const ADD_MODE_KEY = 'grocery_add_mode';
const DRAFT_TOGGLE_KEY = 'grocery_draft_toggle';
const REMINDER_PROMPT_DURATION_MS = 4000;

const QUICK_ADD_KEYS = [
  { name: 'Milk', tKey: 'grocery.quick_add_milk' },
  { name: 'Bread', tKey: 'grocery.quick_add_bread' },
  { name: 'Trash Bags', tKey: 'grocery.quick_add_trash_bags' },
  { name: 'Coffee', tKey: 'grocery.quick_add_coffee' },
  { name: 'Butter', tKey: 'grocery.quick_add_butter' },
  { name: 'Olive Oil', tKey: 'grocery.quick_add_olive_oil' },
] as const;
const UNIT_OPTS = ['ml', 'L', 'g', 'kg'] as const;
const UNIT_LABELS_HE: Record<(typeof UNIT_OPTS)[number], string> = {
  ml: 'מ"ל',
  L: 'ליטר',
  g: 'גרם',
  kg: 'ק"ג',
};

function formatUnitSuffix(unit: string, isHebrew: boolean): string {
  if (!unit) return '';
  if (!isHebrew) return unit;
  const label = UNIT_LABELS_HE[unit as (typeof UNIT_OPTS)[number]] ?? unit;
  return ` ${label}`;
}

// `quantity` is stored as a language-neutral "<number><unit>" string (e.g. "2kg")
// so it stays consistent for every housemate regardless of who added it.
// Only re-localize the unit suffix here, at render time, for the viewer's language.
const SORTED_UNIT_OPTS = [...UNIT_OPTS].sort((a, b) => b.length - a.length);
// Width of the swipe-to-delete panel. Kept in sync between the reveal animation
// and its style so the red panel slides in flush with the row edge.
const SWIPE_DELETE_WIDTH = ms(84);
function localizeQuantityForDisplay(quantity: string, isHebrew: boolean): string {
  if (!isHebrew) return quantity;
  for (const u of SORTED_UNIT_OPTS) {
    if (quantity.endsWith(u)) {
      const prefix = quantity.slice(0, -u.length);
      if (/^\d+(\.\d+)?$/.test(prefix)) {
        return prefix + formatUnitSuffix(u, true);
      }
    }
  }
  return quantity;
}

// ── Category detection ─────────────────────────────────────────────────────────
interface Category {
  labelKey: string;
  icon: IoniconName;
  order: number;
}

const RULES: Array<{ re: RegExp; cat: Category }> = [
  {
    re: /banana|apple|avocado|tomato|carrot|onion|lettuce|orange|strawberry|grape|cucumber|pepper|lime|lemon|herb|spinach|broccoli|salad/i,
    cat: { labelKey: 'grocery.cat_produce', icon: 'nutrition-outline', order: 0 },
  },
  {
    re: /milk|oat milk|almond milk|egg|cheese|butter|yogurt|cream|dairy/i,
    cat: { labelKey: 'grocery.cat_dairy_fridge', icon: 'snow-outline', order: 1 },
  },
  {
    re: /toilet|soap|trash|bin bag|sponge|paper towel|dish|laundry|detergent|bleach|towel|cleaning/i,
    cat: { labelKey: 'grocery.cat_household', icon: 'basket-outline', order: 2 },
  },
  {
    re: /chicken|beef|fish|salmon|tuna|pork|lamb|shrimp|sausage|meat|mince/i,
    cat: { labelKey: 'grocery.cat_meat_fish', icon: 'restaurant-outline', order: 3 },
  },
  {
    re: /pasta|rice|bread|flour|sugar|salt|olive oil|oil|cereal|oats|coffee|tea|sauce|can|tin/i,
    cat: { labelKey: 'grocery.cat_pantry', icon: 'file-tray-stacked-outline', order: 4 },
  },
];
const OTHER_CAT: Category = { labelKey: 'grocery.cat_other', icon: 'cube-outline', order: 99 };

function detectCategory(name: string): Category {
  return RULES.find((r) => r.re.test(name))?.cat ?? OTHER_CAT;
}

function elapsedLabel(
  startedAt: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 1) return t('grocery.just_started');
  if (mins < 60) return t('grocery.mins_at_store', { mins });
  return t('grocery.hours_at_store', { h: Math.floor(mins / 60), m: mins % 60 });
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

const ItemRow = memo(function ItemRow({
  item,
  myId,
  isDuplicate = false,
  onToggle,
  onDelete,
  onIncrement,
  onDecrement,
  onUpdate,
  onLongPress,
}: ItemRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const C = useThemedColors();
  const language = useLanguageStore((s) => s.language);
  const isPlainInt = /^\d+$/.test(item.quantity.trim());
  const qtyNum = isPlainInt ? parseInt(item.quantity, 10) : NaN;
  const hasCount = isPlainInt && qtyNum > 1;
  const bought = item.boughtCount ?? 0;
  const canEdit = item.addedBy === myId;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(item.quantity);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const rowStyles = useMemo(() => makeStyles(C), [C]);

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

  // Web fires a press as two events sometimes; this ref swallows the echo so
  // one tap on +/- counts once. 80ms is well under any real double-tap.
  const lastStepRef = useRef(0);

  const handleDecrement = useCallback((): void => {
    const now = Date.now();
    if (now - lastStepRef.current < 50 || bought === 0) return;
    lastStepRef.current = now;
    Haptics.selectionAsync().catch(() => {});
    onDecrement(item.id);
  }, [bought, item.id, onDecrement]);

  const handleIncrement = useCallback((): void => {
    const now = Date.now();
    if (now - lastStepRef.current < 50 || bought >= qtyNum) return;
    lastStepRef.current = now;
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

  const handleLongPress = useCallback((): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onLongPress(item);
  }, [item, onLongPress]);

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
      setSaveError(t('grocery.could_not_save'));
    } finally {
      setIsSaving(false);
    }
  }, [editName, editQty, item.id, onUpdate, isSaving, t]);

  if (isEditing) {
    return (
      <View>
        <View style={[rowStyles.groceryItem, rowStyles.groceryItemEditing]}>
          <TextInput
            value={editName}
            onChangeText={handleEditNameChange}
            style={rowStyles.editNameInput}
            autoFocus
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder={t('grocery.item_name_placeholder')}
            placeholderTextColor={C.textSecondary}
            accessible
            accessibilityRole="text"
            accessibilityLabel={t('grocery.item_name_edit')}
            accessibilityHint={t('grocery.item_name_edit_hint')}
          />
          <TextInput
            value={editQty}
            onChangeText={handleEditQtyChange}
            style={rowStyles.editQtyInput}
            keyboardType="default"
            returnKeyType="done"
            blurOnSubmit={false}
            onSubmitEditing={saveEdit}
            placeholder={t('grocery.qty_edit_placeholder')}
            placeholderTextColor={C.textSecondary}
            accessible
            accessibilityRole="text"
            accessibilityLabel={t('grocery.qty_edit')}
            accessibilityHint={t('grocery.qty_edit_hint')}
          />
          <Pressable
            onPress={saveEdit}
            style={rowStyles.editActionBtn}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.save_changes')}
          >
            <Ionicons name="checkmark" size={20} color={C.positive} />
          </Pressable>
          <Pressable
            onPress={cancelEdit}
            style={rowStyles.editActionBtn}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.cancel_edit')}
          >
            <Ionicons name="close" size={20} color={C.textSecondary} />
          </Pressable>
        </View>
        {!!saveError && <Text style={rowStyles.inlineError}>{saveError}</Text>}
      </View>
    );
  }

  const row = (
    <Pressable
      style={[
        rowStyles.groceryItem,
        item.isChecked && rowStyles.groceryItemDone,
        item.isPersonal && !item.isDraft && rowStyles.groceryItemPersonal,
      ]}
      // Counted items are driven only by their +/- control, so the row itself
      // isn't a toggle — that also stops a +/- tap from bubbling into a toggle.
      onPress={hasCount ? undefined : handleTap}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.isChecked }}
      accessibilityLabel={
        isDuplicate ? `${item.name}, ${t('grocery.already_on_shared')}` : item.name
      }
      accessibilityHint={t('grocery.long_press_hint')}
    >
      {hasCount ? (
        <View style={rowStyles.counter}>
          <Pressable
            accessible
            onPress={handleDecrement}
            style={[rowStyles.ctrBtn, bought === 0 && rowStyles.ctrBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.decrease_item', { name: item.name })}
            accessibilityState={{ disabled: bought === 0 }}
          >
            <Text style={rowStyles.ctrBtnText}>−</Text>
          </Pressable>
          <Text style={rowStyles.ctrText}>
            {bought}/{qtyNum}
          </Text>
          <Pressable
            accessible
            onPress={handleIncrement}
            style={[rowStyles.ctrBtn, bought >= qtyNum && rowStyles.ctrBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={t('grocery.increase_item', { name: item.name })}
            accessibilityState={{ disabled: bought >= qtyNum }}
          >
            <Text style={rowStyles.ctrBtnText}>+</Text>
          </Pressable>
        </View>
      ) : (
        <Ionicons
          name={item.isChecked ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={item.isChecked ? C.positive : C.border}
        />
      )}
      <View style={rowStyles.itemDetails}>
        <View style={rowStyles.itemMain}>
          <View style={rowStyles.itemNameWrap}>
            <Text style={[rowStyles.itemName, item.isChecked && rowStyles.itemNameDone]}>
              {item.name}
            </Text>
            {/* Counted items show their target via the 0/N counter, so no qty
              badge here; non-counted items still show their quantity label. */}
            {!hasCount && !!item.quantity && item.quantity !== '1' && (
              <View style={rowStyles.itemQty}>
                <Text style={rowStyles.itemQtyText}>
                  {localizeQuantityForDisplay(item.quantity, language === 'he')}
                </Text>
              </View>
            )}
          </View>
          {hasCount && (
            <View style={rowStyles.progressWrap}>
              <View style={rowStyles.progressTrack}>
                <View
                  style={[
                    rowStyles.progressFill,
                    { width: `${Math.round((bought / qtyNum) * 100)}%` as `${number}%` },
                  ]}
                />
              </View>
              <Text style={rowStyles.progressLabel}>
                {bought >= qtyNum
                  ? t('grocery.all_bought')
                  : t('grocery.n_left', { count: qtyNum - bought })}
              </Text>
            </View>
          )}
        </View>
        <View style={rowStyles.itemActions}>
          {isDuplicate && (
            <View
              style={rowStyles.duplicateBadge}
              accessibilityLabel={t('grocery.already_on_shared')}
            >
              <Text style={rowStyles.duplicateBadgeText}>{t('grocery.on_list')}</Text>
            </View>
          )}
          {!!item.comment && (
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={14}
              color={C.textSecondary}
              accessibilityLabel={t('grocery.has_note')}
            />
          )}
          {item.isPersonal && !item.isDraft ? (
            <Ionicons name="lock-closed" size={14} color="rgba(139,92,246,0.6)" />
          ) : (
            <UserAvatar userId={item.addedBy} size={22} />
          )}
          {canEdit && (
            <Pressable
              onPress={startEdit}
              style={rowStyles.editBtn}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.edit_item', { name: item.name })}
            >
              <Ionicons name="pencil-outline" size={15} color={C.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );

  // Swipe left-to-reveal a red Delete, like a native list. Only items you can
  // edit are deletable; others just render the plain row.
  if (!canEdit) return row;
  return (
    <Swipeable
      renderRightActions={(_progress, dragX) => {
        // Slide the panel in 1:1 with the drag so it stays glued to the row's
        // right edge instead of sitting revealed underneath as a floating box.
        const translateX = dragX.interpolate({
          inputRange: [-SWIPE_DELETE_WIDTH, 0],
          outputRange: [0, SWIPE_DELETE_WIDTH],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View style={[rowStyles.swipeDeleteLane, { transform: [{ translateX }] }]}>
            <Pressable
              style={rowStyles.swipeDelete}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={t('grocery.delete_item_name', { name: item.name })}
            >
              <Ionicons name="trash" size={20} color="#fff" />
              <Text style={rowStyles.swipeDeleteText}>{t('common.delete')}</Text>
            </Pressable>
          </Animated.View>
        );
      }}
      overshootRight={false}
      rightThreshold={40}
      friction={2}
    >
      {row}
    </Swipeable>
  );
});

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
interface GroceryItemWithMeta extends GroceryItem {
  isDuplicate?: boolean;
}
interface SectionData {
  title: string;
  icon: IoniconName;
  data: GroceryItemWithMeta[];
  sectionType: 'draft' | 'private' | 'shared';
  /** True on the first ordered section that carries the "remind me" bell. */
  withReminder?: boolean;
}

export default function GroceryScreen(): React.JSX.Element {
  useFeatureGuard('grocery');
  const { t } = useTranslation();
  const router = useRouter();

  const markSeen = useBadgeStore((s) => s.markSeen);
  useFocusEffect(
    useCallback((): void => {
      markSeen('grocery').catch(() => {});
    }, [markSeen])
  );

  const language = useLanguageStore((s) => s.language);
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
  const keepDraftPrivate = useGroceryStore((s) => s.keepDraftPrivate);
  const addComment = useGroceryStore((s) => s.addComment);
  const activeRun = useGroceryStore((s) => s.activeRun);
  const endRun = useGroceryStore((s) => s.endRun);
  const savedLists = useGroceryStore((s) => s.savedLists);
  const isLoadingLists = useGroceryStore((s) => s.isLoadingLists);
  const currentDraftSourceListId = useGroceryStore((s) => s.currentDraftSourceListId);
  const fetchSavedLists = useGroceryStore((s) => s.fetchSavedLists);
  const createSavedList = useGroceryStore((s) => s.createSavedList);
  const updateSavedList = useGroceryStore((s) => s.updateSavedList);
  const deleteSavedList = useGroceryStore((s) => s.deleteSavedList);
  const loadListIntoDraft = useGroceryStore((s) => s.loadListIntoDraft);
  const reminders = useGroceryStore((s) => s.reminders);
  const fetchReminders = useGroceryStore((s) => s.fetchReminders);
  const createReminder = useGroceryStore((s) => s.createReminder);

  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const draftEnabled = useSettingsStore((s) => s.isEnabled('grocery_draft'));

  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('1');
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('shared');
  const [isDraftOn, setIsDraftOn] = useState(false);
  const [note, setNote] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [unit, setUnit] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<GroceryItem | null>(null);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [showSaveListModal, setShowSaveListModal] = useState(false);
  const [saveListMode, setSaveListMode] = useState<SaveListMode>('new');
  const [pendingPublishedItems, setPendingPublishedItems] = useState<SavedListItem[]>([]);
  const [showListEditor, setShowListEditor] = useState(false);
  const [listEditorMode, setListEditorMode] = useState<ListEditorMode>('create');
  const [listEditorTarget, setListEditorTarget] = useState<GroceryList | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const leaveWarningShownRef = useRef(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDefaultLabel, setReminderDefaultLabel] = useState('');
  const {
    name: addedItemName,
    show: showAddedItemPrompt,
    dismiss: dismissAddedItemPrompt,
  } = useAddedItemPrompt(REMINDER_PROMPT_DURATION_MS);

  const inputRef = useRef<TextInput>(null);
  const addBusyRef = useRef(false);
  const C = useThemedColors();
  const styles = useMemo(() => makeStyles(C), [C]);
  const headingFont = useHeadingFont();

  // Restore persisted add-mode preference. Depends on draftEnabled so it
  // re-applies correctly if the feature flag hydrates after mount.
  useEffect((): void => {
    Promise.all([AsyncStorage.getItem(ADD_MODE_KEY), AsyncStorage.getItem(DRAFT_TOGGLE_KEY)])
      .then(([modeVal, draftVal]) => {
        if (modeVal === 'private') setAddMode('private');
        else if (modeVal === 'draft') {
          // Legacy migration: stored 'draft' mode value → shared mode
          setAddMode('shared');
        }
        // modeVal === 'shared' or null → default 'shared' already set

        // DRAFT_TOGGLE_KEY is authoritative when present; only fall back to
        // legacy 'draft' mode inference when the key has never been written.
        if (draftVal !== null) {
          if (draftVal === 'true' && draftEnabled) setIsDraftOn(true);
        } else if (modeVal === 'draft' && draftEnabled) {
          setIsDraftOn(true);
        }
      })
      .catch((err) => {
        console.warn('Failed to restore grocery preferences', err);
        setAddError(t('grocery.failed_restore_prefs'));
      });
  }, [draftEnabled, t]);

  // Fetch saved lists on mount
  useEffect((): void => {
    if (houseId) {
      fetchSavedLists(houseId);
    }
  }, [houseId, fetchSavedLists]);

  // Fetch upcoming personal reminders on mount
  useEffect((): void => {
    if (houseId && myId) {
      fetchReminders(houseId, myId);
    }
  }, [houseId, myId, fetchReminders]);

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
    if (myDraftItems.length === 0) {
      leaveWarningShownRef.current = false;
    }
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

  // Always store the canonical (non-localized) unit so `quantity` stays
  // language-neutral for every housemate; see localizeQuantityForDisplay.
  const qtyNumVal = Math.max(1, parseInt(qty, 10) || 1);
  const resolvedQty = qty + unit;
  const effectiveMode: AddMode =
    addMode === 'private' ? 'private' : draftEnabled && isDraftOn ? 'draft' : 'shared';
  // Which "Add to" destination is currently selected (drives the top chooser).
  const destShared = addMode === 'shared' && !isDraftOn;
  const destPersonal = addMode === 'private';
  const destDraft = addMode === 'shared' && isDraftOn && draftEnabled;
  const checked = useMemo(() => items.filter((i) => i.isChecked), [items]);

  // Animate the "clear checked" bar's height so it slides the list down/up
  // smoothly instead of popping in. rAF-driven (useTween) so it runs on web.
  const clearShown = checked.length > 0;
  const [clearBarH, setClearBarH] = useState(56);
  const clearP = useTween(clearShown ? 1 : 0);

  const sections = useMemo((): SectionData[] => {
    const draftItems = items.filter((i) => i.isDraft && i.addedBy === myId);
    const privateItems = items.filter((i) => i.isPersonal && !i.isDraft && i.addedBy === myId);
    const sharedItems = items.filter((i) => !i.isPersonal);
    const sharedNames = new Set(sharedItems.map((i) => i.name.toLowerCase().trim()));
    const result: SectionData[] = [];

    if (draftItems.length > 0) {
      result.push({
        title: t('grocery.my_draft'),
        icon: 'create-outline',
        sectionType: 'draft',
        data: draftItems.map((i) => ({
          ...i,
          isDuplicate: sharedNames.has(i.name.toLowerCase().trim()),
        })),
      });
    }
    if (privateItems.length > 0) {
      result.push({
        title: t('grocery.my_private_list'),
        icon: 'lock-closed-outline',
        sectionType: 'private',
        data: privateItems,
      });
    }

    const firstIndex = new Map<string, number>();
    const map = new Map<string, SectionData>();
    const keyOrder: string[] = [];
    for (let i = 0; i < sharedItems.length; i++) {
      const item = sharedItems[i];
      const cat = detectCategory(item.name);
      const stableKey = cat.labelKey;
      if (!map.has(stableKey)) {
        map.set(stableKey, {
          title: t(stableKey),
          icon: cat.icon,
          sectionType: 'shared',
          data: [],
        });
        firstIndex.set(stableKey, i);
        keyOrder.push(stableKey);
      }
      map.get(stableKey)!.data.push(item);
    }
    result.push(
      ...keyOrder
        .sort((a, b) => (firstIndex.get(a) ?? 99) - (firstIndex.get(b) ?? 99))
        .map((k) => map.get(k)!)
    );

    // Surface the section you're currently adding to: bring its section(s) to
    // the top while keeping everything else visible below (stable order).
    const targetType = effectiveMode === 'private' ? 'private' : effectiveMode;
    const selected = result.filter((s) => s.sectionType === targetType);
    const rest = result.filter((s) => s.sectionType !== targetType);
    const ordered = [...selected, ...rest];
    // Put the single "remind me" bell on the top section header, whatever its
    // type. Anchoring it to the first *shared* section hid it entirely for
    // anyone whose items are all private or draft (no shared section exists),
    // so they had no way to open the reminder modal for their own list/items.
    if (ordered.length > 0) ordered[0].withReminder = true;
    return ordered;
  }, [items, myId, t, effectiveMode]);

  const handleAdd = useCallback(
    async (quick?: string): Promise<void> => {
      const n = quick ?? itemName.trim();
      // addBusyRef is a synchronous lock: a double-fired press (common on web)
      // or a fast second tap is dropped instead of racing into a duplicate row.
      if (!n || addBusyRef.current) return;
      addBusyRef.current = true;
      setIsAdding(true);
      setAddError(null);
      try {
        // Quick-add carries the count (no unit); typed add carries count + unit.
        const addQty = quick ? qty : resolvedQty;
        // Same-name unchecked item already on this list? Merge into it and bump
        // the quantity instead of creating a separate duplicate row — so "add
        // olive oil x3" becomes one item you can count down, not three rows.
        // Read the freshest list (not the render-time closure) so a just-added
        // item is seen and merged rather than duplicated.
        const currentItems = useGroceryStore.getState().items;
        const inBucket = (i: GroceryItem): boolean =>
          effectiveMode === 'private'
            ? i.isPersonal && !i.isDraft && i.addedBy === myId
            : effectiveMode === 'draft'
              ? i.isDraft && i.addedBy === myId
              : !i.isPersonal;
        const existing = currentItems.find(
          (i) => !i.isChecked && inBucket(i) && i.name.trim().toLowerCase() === n.toLowerCase()
        );
        // Only merge when both quantities are plain counts (empty == 1); a
        // measured amount like "2kg" can't be summed, so it adds a new row.
        const asCount = (q: string): number | null => {
          const s = q.trim();
          if (s === '') return 1;
          return /^\d+$/.test(s) ? parseInt(s, 10) : null;
        };
        const existingCount = existing ? asCount(existing.quantity) : null;
        const addedCount = asCount(addQty);
        if (existing && existingCount !== null && addedCount !== null) {
          await updateItem(existing.id, existing.name, String(existingCount + addedCount));
        } else {
          await addItem(
            n,
            addQty,
            myId,
            houseId ?? '',
            effectiveMode,
            quick ? undefined : note.trim() || undefined
          );
        }
        setItemName('');
        if (!quick) {
          setQty('1');
          setUnit('');
          setNote('');
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAddedItemPrompt(n);
        setTimeout(() => inputRef.current?.focus(), 50);
      } catch {
        setAddError(t('grocery.could_not_add'));
      } finally {
        addBusyRef.current = false;
        setIsAdding(false);
      }
    },
    [
      itemName,
      qty,
      resolvedQty,
      myId,
      houseId,
      addItem,
      updateItem,
      effectiveMode,
      note,
      t,
      showAddedItemPrompt,
    ]
  );

  const handlePublishDraft = useCallback(async (): Promise<void> => {
    if (isPublishing || !myId || !houseId) return;

    // Capture draft items before publishing (needed to save as a list)
    const draftSnapshot = myDraftItems.map((i) => ({ name: i.name, quantity: i.quantity }));
    if (draftSnapshot.length === 0) return;

    setIsPublishing(true);
    setAddError(null);
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
      setAddError(getErrorMessage(err, t('grocery.could_not_share')));
    } finally {
      setIsPublishing(false);
    }
  }, [publishDraftItems, myId, houseId, isPublishing, myDraftItems, currentDraftSourceListId, t]);

  const handleKeepDraftPrivate = useCallback(async (): Promise<void> => {
    if (isPublishing || !myId || !houseId) return;
    if (myDraftItems.length === 0) return;
    setIsPublishing(true);
    setAddError(null);
    try {
      await keepDraftPrivate(myId, houseId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      leaveWarningShownRef.current = false;
    } catch (err) {
      setAddError(getErrorMessage(err, t('grocery.could_not_save_list')));
    } finally {
      setIsPublishing(false);
    }
  }, [keepDraftPrivate, myId, houseId, isPublishing, myDraftItems, t]);

  // ── Saved lists handlers ───────────────────────────────────────────────────
  const handleOpenCreateList = useCallback((): void => {
    setListEditorTarget(null);
    setListEditorMode('create');
    setShowListEditor(true);
  }, []);

  const handleOpenEditList = useCallback((list: GroceryList): void => {
    setListEditorTarget(list);
    setListEditorMode('edit');
    setShowListEditor(true);
  }, []);

  const handleCloseListEditor = useCallback((): void => {
    setShowListEditor(false);
    setListEditorTarget(null);
  }, []);

  const handleSubmitListEditor = useCallback(
    async (name: string, isPrivate: boolean, items: SavedListItem[]): Promise<void> => {
      if (!houseId) throw new Error(t('grocery.could_not_save_list'));
      if (listEditorMode === 'edit' && listEditorTarget) {
        await updateSavedList(listEditorTarget.id, items, { name, isPrivate });
      } else {
        await createSavedList(name, houseId, myId, items, isPrivate, myName);
      }
    },
    [houseId, listEditorMode, listEditorTarget, updateSavedList, createSavedList, myId, myName, t]
  );

  const handleLoadList = useCallback(
    async (list: GroceryList): Promise<void> => {
      if (!houseId) return;
      try {
        await loadListIntoDraft(list, myId, houseId);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch {
        setAddError(t('grocery.could_not_load_list'));
      }
    },
    [loadListIntoDraft, myId, houseId, t]
  );

  const handleDeleteList = useCallback(
    async (listId: string): Promise<void> => {
      try {
        await deleteSavedList(listId);
      } catch {
        setAddError(t('grocery.could_not_delete_list'));
      }
    },
    [deleteSavedList, t]
  );

  // ── Reminder handlers ───────────────────────────────────────────────────────
  const handleOpenGeneralReminder = useCallback((): void => {
    dismissAddedItemPrompt();
    setReminderDefaultLabel('');
    setShowReminderModal(true);
  }, [dismissAddedItemPrompt]);

  const handleOpenItemReminder = useCallback((name: string): void => {
    setReminderDefaultLabel(name);
    setShowReminderModal(true);
  }, []);

  const handleCloseReminderModal = useCallback((): void => {
    setShowReminderModal(false);
    setReminderDefaultLabel('');
  }, []);

  const handleSetReminderForAddedItem = useCallback((): void => {
    const name = addedItemName;
    dismissAddedItemPrompt();
    if (name) handleOpenItemReminder(name);
  }, [addedItemName, dismissAddedItemPrompt, handleOpenItemReminder]);

  const handleSaveReminder = useCallback(
    async (label: string, remindAt: string): Promise<void> => {
      if (!houseId || !myId) {
        throw new Error('Could not set the reminder. Please try again.');
      }
      try {
        await createReminder({
          houseId,
          userId: myId,
          listId: null,
          label,
          remindAt,
        });
      } catch (err) {
        throw err instanceof Error ? err : new Error('Could not set the reminder.');
      }
    },
    [createReminder, houseId, myId]
  );

  // ── Save list modal handlers ───────────────────────────────────────────────
  const handleSaveNew = useCallback(
    async (name: string, isPrivate: boolean): Promise<void> => {
      if (!houseId) return;
      setAddError(null);
      try {
        await createSavedList(name, houseId, myId, pendingPublishedItems, isPrivate, myName);
        setAddError(null);
        setPendingPublishedItems([]);
      } catch (err) {
        setAddError(getErrorMessage(err, t('grocery.could_not_save_list')));
      }
    },
    [createSavedList, houseId, myId, myName, pendingPublishedItems, t]
  );

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
    navigateToBase('/(tabs)/grocery');
  }, []);

  // ── Shopping run handlers ──────────────────────────────────────────────────
  const handleStartRun = useCallback((): void => {
    // Opening the shopping screen starts (or resumes) the run — it calls
    // startRun on mount — so navigate straight there.
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/grocery/shop');
  }, [router]);

  const handleQuickBuy = useCallback((): void => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/grocery/quick-buy');
  }, [router]);

  const doEndRun = useCallback(async (): Promise<void> => {
    try {
      await endRun();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch {
      setAddError(t('grocery.could_not_end_run'));
    }
  }, [endRun, t]);

  const handleEndRun = useCallback((): void => {
    Alert.alert(t('grocery.back_from_shops'), t('grocery.end_run_body'), [
      { text: t('grocery.not_done_yet'), style: 'cancel' },
      {
        text: t('grocery.yep_done'),
        onPress: (): void => {
          doEndRun().catch(() => {});
        },
      },
    ]);
  }, [doEndRun, t]);

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
    if (!houseId) {
      Alert.alert(t('grocery.could_not_clear'), t('grocery.something_went_wrong'));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    clearChecked(houseId).catch(() => {
      Alert.alert(t('grocery.could_not_clear'), t('grocery.something_went_wrong'));
    });
  }, [clearChecked, houseId, t]);
  const handleLongPress = useCallback((item: GroceryItem): void => {
    setSelectedItem(item);
  }, []);
  const handleCloseModal = useCallback((): void => {
    setSelectedItem(null);
  }, []);
  const onSaveComment = useCallback(
    (id: string, comment: string): Promise<void> => addComment(id, comment),
    [addComment]
  );

  // ── Mode controls ─────────────────────────────────────────────────────────
  const handleSetShared = useCallback((): void => {
    setAddError(null);
    const prev = addMode;
    setAddMode('shared');
    AsyncStorage.setItem(ADD_MODE_KEY, 'shared').catch(() => {
      setAddMode(prev);
      setAddError(t('grocery.could_not_save_pref'));
    });
  }, [addMode, t]);
  const handleSetPrivate = useCallback((): void => {
    setAddError(null);
    const prev = addMode;
    setAddMode('private');
    AsyncStorage.setItem(ADD_MODE_KEY, 'private').catch(() => {
      setAddMode(prev);
      setAddError(t('grocery.could_not_save_pref'));
    });
  }, [addMode, t]);
  const handleToggleDraft = useCallback(
    (value: boolean): void => {
      setAddError(null);
      setIsDraftOn(value);
      AsyncStorage.setItem(DRAFT_TOGGLE_KEY, String(value)).catch(() => {
        setIsDraftOn(!value);
        setAddError(t('grocery.could_not_save_pref'));
      });
    },
    [t]
  );

  // "Add to" chooser: Shared / Personal / Draft map onto addMode + isDraftOn.
  const handleSelectShared = useCallback((): void => {
    handleSetShared();
    handleToggleDraft(false);
  }, [handleSetShared, handleToggleDraft]);
  const handleSelectDraft = useCallback((): void => {
    handleSetShared();
    handleToggleDraft(true);
  }, [handleSetShared, handleToggleDraft]);

  const handleItemNameChange = useCallback((v: string): void => {
    setItemName(v);
    setAddError(null);
  }, []);
  const handleAddPress = useCallback((): void => {
    handleAdd();
  }, [handleAdd]);
  const changeQty = useCallback((delta: number): void => {
    Haptics.selectionAsync().catch(() => {});
    setQty((prev) => {
      const next = (parseInt(prev, 10) || 1) + delta;
      return String(Math.max(1, Math.min(99, next)));
    });
  }, []);
  const handleUnitToggle = useCallback((u: string): void => {
    setUnit((prev) => (prev === u ? '' : u));
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
        onLongPress={handleLongPress}
      />
    ),
    [myId, onToggle, onDelete, onInc, onDec, onUpdate, handleLongPress]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }): React.JSX.Element => {
      // A single "remind me" bell lives on whichever section is at the top of
      // the list (see `sections`), so it's reachable from private/draft items
      // too — not only when a shared section is present.
      const reminderBell = section.withReminder ? (
        <Pressable
          style={styles.sectionBell}
          onPress={handleOpenGeneralReminder}
          hitSlop={{ top: ms(8), bottom: ms(8), left: ms(8), right: ms(8) }}
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: false }}
          accessibilityLabel={t('grocery.remind_me')}
        >
          <Ionicons name="alarm-outline" size={18} color={C.primary} />
          {reminders.length > 0 && (
            <View style={styles.sectionBellBadge}>
              <Text style={styles.sectionBellBadgeText}>
                {reminders.length > 9 ? '9+' : reminders.length}
              </Text>
            </View>
          )}
        </Pressable>
      ) : null;

      if (section.sectionType === 'draft') {
        const doneDisabled = isPublishing || !myId || !houseId;
        return (
          <View style={styles.catTitleDraftRow}>
            <View style={[styles.catTitle, styles.catTitleFlex]}>
              <Ionicons name={section.icon} size={15} color="rgb(133,77,14)" />
              <Text style={[styles.catTitleText, styles.catTitleTextDraft]}>{section.title}</Text>
            </View>
            {reminderBell}
            <Pressable
              style={[styles.draftPrivateBtn, doneDisabled && styles.draftPublishBtnOff]}
              onPress={handleKeepDraftPrivate}
              disabled={doneDisabled}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: doneDisabled }}
              accessibilityLabel={t('grocery.keep_draft_private_a11y')}
              accessibilityHint={t('grocery.keep_draft_private_a11y_hint')}
            >
              <Ionicons name="lock-closed" size={22} color="rgb(76,29,149)" />
            </Pressable>
            <Pressable
              style={[styles.draftPublishBtn, doneDisabled && styles.draftPublishBtnOff]}
              onPress={handlePublishDraft}
              disabled={doneDisabled}
              accessible
              accessibilityRole="button"
              accessibilityState={{ disabled: doneDisabled }}
              accessibilityLabel={t('grocery.share_draft_a11y')}
              accessibilityHint={t('grocery.share_draft_a11y_hint')}
            >
              {isPublishing ? (
                <ActivityIndicator size="small" color="rgb(133,77,14)" />
              ) : (
                <Ionicons name="checkmark-circle" size={26} color="rgb(133,77,14)" />
              )}
            </Pressable>
          </View>
        );
      }
      if (section.sectionType === 'private') {
        return (
          <View style={[styles.catTitle, styles.catTitlePersonal]}>
            <Ionicons name={section.icon} size={15} color="rgb(76,29,149)" />
            <Text style={[styles.catTitleText, styles.catTitleTextPersonal]}>{section.title}</Text>
            {reminderBell}
          </View>
        );
      }
      return (
        <View style={styles.catTitle}>
          <Ionicons name={section.icon} size={15} color={C.textSecondary} />
          <Text style={styles.catTitleText}>{section.title}</Text>
          {reminderBell}
        </View>
      );
    },
    [
      handlePublishDraft,
      handleKeepDraftPrivate,
      isPublishing,
      myId,
      houseId,
      styles,
      t,
      C,
      handleOpenGeneralReminder,
      reminders,
    ]
  );

  const isMyRun = !!activeRun && activeRun.shopperId === myId;

  const ShoppingRunCard = (): React.JSX.Element => {
    if (activeRun && isMyRun) {
      return (
        <View style={[styles.shoppingRunCard, styles.shoppingRunCardActive]}>
          <View style={[styles.shoppingIcon, styles.shoppingIconActive]}>
            <Ionicons name="bag-handle" size={26} color="rgb(22,101,52)" />
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={styles.titleLg}>{t('grocery.you_at_store')}</Text>
            <Text style={styles.textSm}>
              {elapsedLabel(activeRun.startedAt, t)} · {t('grocery.housemates_can_see')}
            </Text>
          </View>
          <Pressable
            style={[styles.btnPrimary, styles.btnFull]}
            onPress={handleStartRun}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.shop.continue')}
          >
            <Text style={styles.btnPrimaryText}>{t('grocery.shop.continue')}</Text>
          </Pressable>
          <Pressable
            style={styles.btnGhost}
            onPress={handleEndRun}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('grocery.done_shopping')}
          >
            <Text style={styles.btnGhostText}>{t('grocery.done_shopping')}</Text>
          </Pressable>
        </View>
      );
    }
    if (activeRun && !isMyRun) {
      return (
        <View style={[styles.shoppingRunCard, styles.shoppingRunCardActive]}>
          <View style={[styles.shoppingIcon, styles.shoppingIconActive]}>
            <Ionicons name="bag-handle" size={26} color="rgb(22,101,52)" />
          </View>
          <View style={styles.shoppingCopy}>
            <Text style={styles.titleLg}>
              {t('grocery.at_store', { name: activeRun.shopperName })}
            </Text>
            <Text style={styles.textSm}>{t('grocery.at_store_hint')}</Text>
          </View>
          <View style={styles.shopperBadge}>
            <UserAvatar userId={activeRun.shopperId} size={28} />
            <Text style={styles.shopperBadgeText}>{elapsedLabel(activeRun.startedAt, t)}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.shoppingRunCard}>
        <View style={styles.shoppingIcon}>
          <Ionicons name="bag-handle-outline" size={26} color={C.primary} />
        </View>
        <View style={styles.shoppingCopy}>
          <Text style={styles.titleLg}>{t('grocery.start_shopping_run')}</Text>
          <Text style={styles.textSm}>{t('grocery.start_shopping_hint')}</Text>
        </View>
        <Pressable
          style={[styles.btnPrimary, styles.btnFull]}
          onPress={handleStartRun}
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>{t('grocery.im_going_shopping')}</Text>
        </Pressable>
        <Pressable
          style={styles.btnGhost}
          onPress={handleQuickBuy}
          accessibilityRole="button"
          accessibilityLabel={t('grocery.shop.quick_buy')}
        >
          <Ionicons name="flash-outline" size={16} color={C.primary} />
          <Text style={styles.btnGhostText}>{t('grocery.shop.quick_buy')}</Text>
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.root} edges={['top']}>
          <View style={styles.flex}>
            <View
              style={[styles.clearBarWrap, { height: clearP * clearBarH, opacity: clearP }]}
              pointerEvents={clearShown ? 'auto' : 'none'}
            >
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0 && Math.abs(h - clearBarH) > 1) setClearBarH(h);
                }}
              >
                <Pressable
                  style={styles.clearBar}
                  onPress={handleClear}
                  accessibilityRole="button"
                  accessibilityElementsHidden={!clearShown}
                  accessibilityLabel={t('grocery.clear_items_a11y', { count: checked.length })}
                >
                  <View style={styles.clearBarLeft}>
                    <Ionicons name="checkmark-done-outline" size={16} color={C.positive} />
                    <Text style={styles.clearBarCount}>
                      {t('grocery.checked_count', { count: checked.length })}
                    </Text>
                  </View>
                  <Text style={styles.clearBarAction}>{t('grocery.clear_checked')}</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.flex}>
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
                    <BackLink label={t('common.home')} />
                    {/* ── Hero card ─────────────────────────────────────────── */}
                    <View style={styles.headerCard}>
                      <View style={styles.headerCopy}>
                        <Text style={[styles.titleHero, headingFont]}>
                          {t('grocery.shared_groceries')}
                        </Text>
                        <Text style={styles.textBase}>{t('grocery.add_things_hint')}</Text>
                      </View>

                      {/* ── "Add to" chooser: Shared | Personal | Draft ──── */}
                      <Text style={styles.addToLabel}>{t('grocery.add_to')}</Text>
                      <View style={styles.segWrap} accessibilityRole="radiogroup">
                        <Pressable
                          style={[styles.segBtn, destShared && styles.segBtnShared]}
                          onPress={handleSelectShared}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: destShared }}
                          accessibilityLabel={t('grocery.shared_tab')}
                        >
                          <Ionicons
                            name="people-outline"
                            size={15}
                            color={destShared ? '#fff' : C.textSecondary}
                          />
                          <Text style={[styles.segText, destShared && styles.segTextOn]}>
                            {t('grocery.shared_seg')}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.segBtn, destPersonal && styles.segBtnPersonalOn]}
                          onPress={handleSetPrivate}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: destPersonal }}
                          accessibilityLabel={t('grocery.private_tab')}
                        >
                          <Ionicons
                            name="person-outline"
                            size={15}
                            color={destPersonal ? '#fff' : C.textSecondary}
                          />
                          <Text style={[styles.segText, destPersonal && styles.segTextOn]}>
                            {t('grocery.personal_seg')}
                          </Text>
                        </Pressable>
                        {draftEnabled && (
                          <Pressable
                            style={[styles.segBtn, destDraft && styles.segBtnDraftOn]}
                            onPress={handleSelectDraft}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: destDraft }}
                            accessibilityLabel={t('grocery.draft_mode')}
                          >
                            <Ionicons
                              name="create-outline"
                              size={15}
                              color={destDraft ? '#fff' : C.textSecondary}
                            />
                            <Text style={[styles.segText, destDraft && styles.segTextOn]}>
                              {t('grocery.draft_seg')}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                      <Text style={styles.addToHint}>
                        {destPersonal
                          ? t('grocery.personal_hint')
                          : destDraft
                            ? t('grocery.draft_on_hint')
                            : t('grocery.shared_hint')}
                      </Text>

                      {/* ── Error banner ──────────────────────────────────── */}
                      {!!addError && (
                        <View style={styles.errorBanner}>
                          <Text style={styles.errorBannerText}>{addError}</Text>
                        </View>
                      )}

                      {/* ── Inline add input ──────────────────────────────── */}
                      <View
                        style={[
                          styles.addRow,
                          effectiveMode === 'private' && styles.addRowPersonal,
                        ]}
                      >
                        <TextInput
                          ref={inputRef}
                          value={itemName}
                          onChangeText={handleItemNameChange}
                          placeholder={t('grocery.item_placeholder')}
                          placeholderTextColor={C.textSecondary}
                          style={styles.addInput}
                          returnKeyType="done"
                          blurOnSubmit={false}
                          onSubmitEditing={handleAddPress}
                          accessible
                          accessibilityRole="search"
                          accessibilityLabel={t('grocery.add_item_a11y')}
                          accessibilityHint={t('grocery.add_item_hint')}
                        />
                        <Pressable
                          style={[
                            styles.addBtn,
                            (!itemName.trim() || isAdding) && styles.addBtnOff,
                            effectiveMode === 'private' && styles.addBtnPersonal,
                          ]}
                          onPress={handleAddPress}
                          disabled={!itemName.trim() || isAdding}
                          accessibilityRole="button"
                          accessibilityLabel={t('grocery.add_item')}
                        >
                          <Text style={styles.addBtnText}>{isAdding ? '…' : '+'}</Text>
                        </Pressable>
                      </View>

                      {/* ── Qty stepper: choose how many to buy ──────────── */}
                      <View style={styles.qtyRow}>
                        <Text style={styles.qtyLabel}>{t('grocery.qty_label')}</Text>
                        <View style={styles.qtyStepper}>
                          <Pressable
                            style={[styles.qtyStepBtn, qtyNumVal <= 1 && styles.qtyStepBtnOff]}
                            onPress={() => changeQty(-1)}
                            disabled={qtyNumVal <= 1}
                            hitSlop={6}
                            accessible
                            accessibilityRole="button"
                            accessibilityLabel={t('grocery.qty_decrease')}
                            accessibilityState={{ disabled: qtyNumVal <= 1 }}
                          >
                            <Text style={styles.qtyStepSign}>−</Text>
                          </Pressable>
                          <Text style={styles.qtyStepValue}>{qtyNumVal}</Text>
                          <Pressable
                            style={styles.qtyStepBtn}
                            onPress={() => changeQty(1)}
                            hitSlop={6}
                            accessible
                            accessibilityRole="button"
                            accessibilityLabel={t('grocery.qty_increase')}
                          >
                            <Text style={styles.qtyStepSign}>+</Text>
                          </Pressable>
                        </View>
                      </View>

                      {/* ── Unit selector ────────────────────────────────── */}
                      <View style={styles.qtyRow}>
                        <Text style={styles.qtyLabel}>{t('grocery.unit_label')}</Text>
                        <View style={styles.qtyPresets}>
                          {UNIT_OPTS.map((u) => {
                            const active = unit === u;
                            const unitLabel = language === 'he' ? UNIT_LABELS_HE[u] : u;
                            return (
                              <Pressable
                                key={u}
                                style={[styles.qtyBtn, active && styles.qtyBtnOn]}
                                onPress={() => handleUnitToggle(u)}
                                hitSlop={4}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                accessibilityLabel={t('grocery.unit_preset', { u: unitLabel })}
                              >
                                <Text style={[styles.qtyBtnText, active && styles.qtyBtnTextOn]}>
                                  {unitLabel}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>

                      {/* ── Note (optional) ─────────────────────────────── */}
                      <View style={styles.noteRow}>
                        <Ionicons name="chatbubble-outline" size={15} color={C.textTertiary} />
                        <TextInput
                          value={note}
                          onChangeText={setNote}
                          placeholder={t('grocery.note_placeholder')}
                          placeholderTextColor={C.textTertiary}
                          style={styles.noteInput}
                          returnKeyType="done"
                          onSubmitEditing={handleAddPress}
                          accessibilityLabel={t('grocery.note_label')}
                          accessibilityHint={t('grocery.note_hint')}
                        />
                      </View>

                      {/* ── Quick Add (to current mode) ───────────────────── */}
                      <View>
                        <Text style={[styles.eyebrow, styles.quickAddLabel]}>
                          {t('grocery.quick_add')}
                        </Text>
                        <View style={styles.quickAdds}>
                          {QUICK_ADD_KEYS.map((qa) => (
                            <Pressable
                              key={qa.tKey}
                              style={styles.quickAddBtn}
                              onPress={() => handleQuickAdd(t(qa.tKey))}
                              accessibilityRole="button"
                              accessibilityLabel={t('grocery.add_quick', { name: t(qa.tKey) })}
                            >
                              <Text style={styles.quickAddText}>+ {t(qa.tKey)}</Text>
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
                      onCreateList={handleOpenCreateList}
                      onEditList={handleOpenEditList}
                    />

                    {/* ── Load / error states ─────────────────────────────────── */}
                    {isLoading && items.length === 0 && (
                      <LoadingSpinner size={64} style={styles.loadingIndicator} />
                    )}
                    {!!error && (
                      <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{error}</Text>
                      </View>
                    )}
                  </View>
                }
                ListEmptyComponent={
                  <View style={styles.emptyWrap}>
                    <Ionicons
                      name="cart-outline"
                      size={44}
                      color={C.textTertiary}
                      style={styles.emptyIcon}
                    />
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
            </View>
          </View>

          <View style={styles.reminderPromptOverlay} pointerEvents="box-none">
            <ReminderPromptBanner
              itemName={addedItemName}
              onSet={handleSetReminderForAddedItem}
              onDismiss={dismissAddedItemPrompt}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <GroceryItemDetailModal
        item={selectedItem}
        visible={!!selectedItem}
        myId={myId}
        onClose={handleCloseModal}
        onSaveComment={onSaveComment}
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

      <GroceryListEditorModal
        visible={showListEditor}
        mode={listEditorMode}
        initialName={listEditorTarget?.name ?? ''}
        initialIsPrivate={listEditorTarget?.isPrivate ?? false}
        initialItems={
          listEditorTarget?.items.map((i) => ({ name: i.name, quantity: i.quantity })) ?? []
        }
        onSubmit={handleSubmitListEditor}
        onClose={handleCloseListEditor}
      />

      <LeaveWithoutShareModal
        visible={showLeaveModal}
        draftCount={myDraftItems.length}
        onLeave={handleLeave}
        onStayAndShare={handleStayAndShare}
      />

      <GroceryReminderModal
        visible={showReminderModal}
        defaultLabel={reminderDefaultLabel}
        onClose={handleCloseReminderModal}
        onSave={handleSaveReminder}
      />
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens) {
  const successSubtle = C.success + '12';
  const isDark = C.background === darkColors.background;
  return StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1, backgroundColor: C.background },
    listContent: { paddingHorizontal: ms(16), paddingTop: ms(4), paddingBottom: ms(8) },
    // RNW's Switch thumb mispositions under an inherited RTL `direction`; isolate it to LTR.
    switchLtr: { writingDirection: 'ltr' } as ViewStyle,
    reminderPromptOverlay: {
      position: 'absolute',
      top: ms(8),
      left: ms(16),
      right: ms(16),
    },

    headerCard: {
      backgroundColor: C.surface,
      borderRadius: ms(20),
      borderWidth: 1,
      borderColor: C.border,
      padding: ms(20),
      gap: ms(16),
      marginBottom: ms(16),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    headerCopy: { gap: ms(6) },
    sectionBell: {
      marginLeft: 'auto',
      width: ms(32),
      height: ms(32),
      borderRadius: ms(16),
      backgroundColor: C.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionBellBadge: {
      position: 'absolute',
      top: ms(-2),
      right: ms(-2),
      minWidth: ms(15),
      height: ms(15),
      borderRadius: ms(8),
      backgroundColor: C.warning,
      borderWidth: 1.5,
      borderColor: C.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ms(3),
    },
    sectionBellBadgeText: { fontSize: mf(8.5), ...font.bold, color: '#fff' },

    titleHero: {
      fontSize: mf(26),
      ...font.extrabold,
      color: C.textPrimary,
      letterSpacing: -0.78,
      lineHeight: mf(31),
    },
    titleLg: {
      fontSize: mf(18),
      ...font.bold,
      color: C.textPrimary,
      letterSpacing: -0.36,
      textAlign: 'center',
    },
    textBase: { fontSize: mf(15), ...font.regular, color: C.textSecondary, lineHeight: mf(22) },
    textSm: {
      fontSize: mf(13),
      ...font.regular,
      color: C.textSecondary,
      lineHeight: mf(18),
      textAlign: 'center',
    },
    eyebrow: {
      fontSize: mf(12),
      ...font.bold,
      color: C.textSecondary,
      letterSpacing: 0.72,
      textTransform: 'uppercase',
    },

    // ── "Add to" chooser (v2)
    addToLabel: {
      fontSize: mf(11),
      ...font.bold,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: C.textTertiary,
      marginBottom: ms(7),
    },
    segWrap: {
      flexDirection: 'row',
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(13),
      padding: ms(4),
      gap: ms(4),
    },
    segBtn: {
      flex: 1,
      minHeight: ms(44),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      borderRadius: ms(10),
      paddingHorizontal: ms(4),
    },
    segBtnShared: { backgroundColor: C.primary },
    segBtnPersonalOn: { backgroundColor: '#7C4DFF' },
    segBtnDraftOn: { backgroundColor: C.warning },
    segText: { fontSize: mf(13), ...font.bold, color: C.textSecondary },
    segTextOn: { color: '#fff' },
    addToHint: { fontSize: mf(11.5), ...font.regular, color: C.textTertiary, marginTop: ms(7) },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      backgroundColor: C.surfaceSecondary,
      borderRadius: ms(11),
      paddingHorizontal: ms(11),
      minHeight: ms(44),
      marginTop: ms(10),
    },
    noteInput: {
      flex: 1,
      fontSize: mf(14),
      ...font.regular,
      color: C.textPrimary,
      paddingVertical: ms(8),
    },

    modeToggle: { flexDirection: 'row', gap: ms(6) },
    modeBtn: {
      flex: 1,
      minHeight: ms(44),
      borderRadius: ms(10),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    modeBtnOn: { backgroundColor: C.primary, borderColor: C.primary },
    modeBtnDraft: {
      backgroundColor: 'rgba(224,178,77,0.15)',
      borderColor: 'rgba(224,178,77,0.55)',
    },
    modeBtnPersonal: {
      backgroundColor: 'rgba(139,92,246,0.12)',
      borderColor: 'rgba(139,92,246,0.4)',
    },
    modeBtnText: { fontSize: mf(13), ...font.semibold, color: C.textSecondary },
    modeBtnTextOn: { color: '#FFFFFF' },
    // Light theme needs a much darker purple than dark theme to clear 4.5:1 contrast
    // against the pale modeBtnPersonal background.
    modeBtnTextPersonal: { color: isDark ? 'rgb(196,181,253)' : '#5B21B6' },

    // ── Draft mode toggle row
    draftToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: ms(14),
      paddingVertical: ms(12),
      minHeight: ms(52),
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      gap: ms(12),
    },
    draftToggleRowOn: {
      borderColor: 'rgba(224,178,77,0.55)',
      backgroundColor: 'rgba(224,178,77,0.08)',
    },
    draftToggleInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: ms(10), flex: 1 },
    draftToggleText: { flex: 1 },
    draftToggleLabel: { fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    draftToggleLabelOn: { color: 'rgb(133,77,14)' },
    draftToggleSub: { fontSize: mf(12), ...font.regular, color: C.textSecondary, marginTop: ms(1) },

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      borderRadius: ms(12),
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surfaceSecondary,
      paddingEnd: ms(6),
      paddingStart: ms(4),
      height: ms(50),
    },
    addRowPersonal: { borderColor: PERSONAL_BORDER, backgroundColor: PERSONAL_BG },
    addInput: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      paddingHorizontal: ms(10),
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
    },
    addBtn: {
      width: ms(44),
      height: ms(44),
      borderRadius: ms(10),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    addBtnOff: { backgroundColor: C.textDisabled },
    addBtnPersonal: { backgroundColor: 'rgb(124,58,237)' },
    addBtnText: { fontSize: mf(22), ...font.bold, color: '#FFFFFF', lineHeight: mf(26) },

    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: ms(48),
      paddingHorizontal: ms(18),
      borderRadius: ms(10),
      backgroundColor: C.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    btnPrimaryText: { fontSize: mf(15), ...font.semibold, color: '#FFFFFF' },
    btnFull: { alignSelf: 'stretch' },
    btnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: ms(6),
      minHeight: ms(44),
      paddingHorizontal: ms(12),
    },
    btnGhostText: { fontSize: mf(14), ...font.semibold, color: C.primary },

    qtyRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), flexWrap: 'wrap' },
    qtyLabel: { fontSize: mf(13), ...font.semibold, color: C.textSecondary },
    qtyPresets: { flexDirection: 'row', gap: ms(6) },
    qtyBtn: {
      minWidth: ms(36),
      height: ms(36),
      borderRadius: 9999,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: ms(10),
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
    },
    qtyBtnOn: { backgroundColor: C.primary, borderColor: C.primary },
    qtyBtnText: { fontSize: mf(14), ...font.semibold, color: C.textPrimary },
    qtyBtnTextOn: { color: '#FFFFFF' },
    qtyStepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(4),
      backgroundColor: C.surfaceSecondary,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: C.border,
      padding: ms(3),
    },
    qtyStepBtn: {
      width: ms(34),
      height: ms(34),
      borderRadius: 9999,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.surface,
    },
    qtyStepBtnOff: { opacity: 0.4 },
    qtyStepSign: { fontSize: mf(20), ...font.bold, color: C.primary, lineHeight: mf(24) },
    qtyStepValue: {
      minWidth: ms(28),
      textAlign: 'center',
      fontSize: mf(16),
      ...font.extrabold,
      color: C.textPrimary,
    },

    quickAddLabel: { marginBottom: ms(8) },
    quickAdds: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8) },
    quickAddBtn: {
      paddingVertical: ms(7),
      paddingHorizontal: ms(12),
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 9999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    quickAddText: { fontSize: mf(13), ...font.semibold, color: C.textPrimary },

    catTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      paddingHorizontal: ms(4),
      paddingTop: ms(8),
      paddingBottom: ms(4),
    },
    catTitlePersonal: {
      backgroundColor: PERSONAL_BG,
      borderRadius: ms(8),
      paddingHorizontal: ms(10),
      borderWidth: 1,
      borderColor: PERSONAL_BORDER,
    },
    catTitleDraftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: ms(8),
      paddingBottom: ms(4),
      gap: ms(8),
    },
    catTitleFlex: { flex: 1 },
    catTitleText: { fontSize: mf(14), ...font.bold, color: C.textPrimary },
    catTitleTextDraft: { color: 'rgb(133,77,14)' },
    catTitleTextPersonal: { color: 'rgb(76,29,149)' },

    draftPublishBtn: {
      width: ms(44),
      height: ms(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    draftPrivateBtn: {
      width: ms(44),
      height: ms(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    draftPublishBtnOff: { opacity: 0.35 },

    groceryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(12),
      paddingHorizontal: ms(14),
      paddingVertical: ms(12),
      borderRadius: ms(14),
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    groceryItemDone: { opacity: 0.5, borderColor: 'transparent' },
    groceryItemPersonal: { backgroundColor: PERSONAL_BG, borderColor: PERSONAL_BORDER },
    groceryItemEditing: { backgroundColor: C.surface, borderColor: C.primary, gap: ms(8) },

    duplicateBadge: {
      backgroundColor: 'rgba(234,179,8,0.15)',
      borderRadius: ms(6),
      paddingHorizontal: ms(6),
      paddingVertical: ms(2),
      borderWidth: 1,
      borderColor: 'rgba(234,179,8,0.4)',
    },
    duplicateBadgeText: { fontSize: mf(11), ...font.semibold, color: 'rgb(133,77,14)' },
    itemSep: { height: ms(8) },
    sectionSep: { height: ms(30) },

    itemDetails: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: ms(12),
      minWidth: 0,
    },
    itemMain: { flex: 1, minWidth: 0, gap: ms(6) },
    itemNameWrap: { flexDirection: 'row', alignItems: 'center', gap: ms(8), minWidth: 0 },
    progressWrap: { gap: ms(4) },
    progressTrack: {
      height: ms(5),
      borderRadius: ms(3),
      backgroundColor: C.surfaceSecondary,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: ms(3), backgroundColor: C.success },
    progressLabel: { fontSize: mf(11.5), ...font.semibold, color: C.textSecondary },
    itemName: { fontSize: mf(15), ...font.semibold, color: C.textPrimary, flexShrink: 1 },
    itemNameDone: { textDecorationLine: 'line-through', color: C.textSecondary },
    itemQty: {
      backgroundColor: C.secondary,
      paddingHorizontal: ms(6),
      paddingVertical: ms(2),
      borderRadius: ms(6),
      flexShrink: 0,
    },
    itemQtyText: { fontSize: mf(12), ...font.bold, color: C.textSecondary },
    itemActions: { flexDirection: 'row', alignItems: 'center', gap: ms(6), flexShrink: 0 },
    editBtn: { width: ms(44), height: ms(44), justifyContent: 'center', alignItems: 'center' },
    // Full-height lane flush to the row's right edge; the panel inside fills it so
    // there's no misaligned floating box peeking out during a slow swipe-back.
    swipeDeleteLane: { width: SWIPE_DELETE_WIDTH },
    swipeDelete: {
      flex: 1,
      backgroundColor: C.danger,
      justifyContent: 'center',
      alignItems: 'center',
      gap: ms(3),
      borderTopRightRadius: ms(14),
      borderBottomRightRadius: ms(14),
    },
    swipeDeleteText: { fontSize: mf(12), ...font.bold, color: '#fff' },

    editNameInput: {
      flex: 1,
      minWidth: 0,
      height: ms(44),
      paddingHorizontal: ms(10),
      borderRadius: ms(8),
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.primary,
      fontSize: mf(15),
      ...font.regular,
      color: C.textPrimary,
    },
    editQtyInput: {
      width: ms(60),
      height: ms(44),
      paddingHorizontal: ms(8),
      borderRadius: ms(8),
      backgroundColor: C.surfaceSecondary,
      borderWidth: 1,
      borderColor: C.border,
      fontSize: mf(14),
      ...font.regular,
      color: C.textPrimary,
      textAlign: 'center',
    },
    editActionBtn: {
      width: ms(44),
      height: ms(44),
      justifyContent: 'center',
      alignItems: 'center',
    },
    inlineError: {
      fontSize: mf(12),
      color: '#D94F4F',
      paddingTop: ms(4),
      paddingHorizontal: ms(4),
    },

    counter: { flexDirection: 'row', alignItems: 'center', gap: ms(4), flexShrink: 0 },
    ctrBtn: {
      minWidth: ms(44),
      minHeight: ms(44),
      borderRadius: ms(22),
      backgroundColor: C.surfaceSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    },
    ctrBtnOff: { opacity: 0.3 },
    ctrBtnText: { fontSize: mf(16), ...font.bold, color: C.primary, lineHeight: mf(20) },
    ctrText: {
      fontSize: mf(14),
      ...font.bold,
      color: C.textPrimary,
      minWidth: ms(32),
      textAlign: 'center',
    },

    avatar: { justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    avatarText: { color: '#FFFFFF', ...font.bold },

    loadingIndicator: { marginBottom: ms(8) },
    errorBanner: {
      backgroundColor: C.dangerTint,
      borderRadius: ms(10),
      padding: ms(12),
      marginBottom: ms(8),
    },
    errorBannerText: { fontSize: mf(13), color: C.danger },

    emptyWrap: { alignItems: 'center', paddingVertical: ms(48), gap: ms(8) },
    emptyIcon: { marginBottom: sizes.sm },
    emptyTitle: { fontSize: mf(16), ...font.bold, color: C.textPrimary },
    emptyText: { fontSize: mf(14), ...font.regular, color: C.textSecondary, textAlign: 'center' },

    clearBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: ms(14),
      paddingVertical: ms(12),
      minHeight: ms(44),
      borderRadius: ms(12),
      marginHorizontal: ms(16),
      marginTop: ms(8),
      marginBottom: ms(4),
      backgroundColor: 'rgba(34,197,94,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(34,197,94,0.25)',
    },
    clearBarWrap: { overflow: 'hidden' },
    clearBarLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
    clearBarCount: { fontSize: mf(14), ...font.semibold, color: C.positive },
    clearBarAction: { fontSize: mf(13), ...font.semibold, color: C.positive },

    footer: { gap: ms(20) },

    shoppingRunCard: {
      paddingVertical: ms(24),
      paddingHorizontal: ms(20),
      borderRadius: ms(20),
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: SHOP_BORDER,
      alignItems: 'center',
      gap: ms(14),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    shoppingRunCardActive: { backgroundColor: successSubtle, borderColor: SHOP_ACTIVE_BORDER },
    shoppingIcon: {
      width: ms(56),
      height: ms(56),
      borderRadius: ms(28),
      backgroundColor: 'rgba(255,255,255,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: ms(2) },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    shoppingIconActive: { backgroundColor: 'rgba(220,255,230,0.9)' },
    shoppingCopy: { alignItems: 'center', gap: ms(4), paddingHorizontal: ms(8) },
    shopperBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      backgroundColor: 'rgba(255,255,255,0.7)',
      paddingHorizontal: ms(12),
      paddingVertical: ms(6),
      borderRadius: 9999,
    },
    shopperBadgeText: { fontSize: mf(13), ...font.semibold, color: C.textPrimary },

    bottomPad: { height: sizes.bottomTabContentPadding },
  });
}
