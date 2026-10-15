import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { withFeatureGuard } from '@components/shared/withFeatureGuard';
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
} from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useMemberName } from '@hooks/useMemberName';
import { useNow } from '@hooks/useNow';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { BackLink } from '@components/shared/BackLink';
import { GroceryItemRow } from '@components/grocery/GroceryItemRow';
import { GroceryHeader } from '@components/grocery/GroceryHeader';
import { CategoryTiles, type CategoryTileData } from '@components/grocery/CategoryTiles';
import { ShoppingRunCard } from '@components/grocery/ShoppingRunCard';
import { AddItemSheet, type AddDestination } from '@components/grocery/AddItemSheet';
import { StaleItemNudge } from '@components/grocery/StaleItemNudge';
import { getItemAge, isItemStale } from '@utils/groceryAge';
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
import { detectCategory, type CategoryTone } from '@utils/groceryCategory';
import { useHeadingFont } from '@hooks/useHeadingFont';
import type { IoniconName } from '@/types/icons';

import { mf, ms } from '@utils/responsive';

const PERSONAL_BG = 'rgba(124,58,237,0.08)';
const PERSONAL_BORDER = 'rgba(167,139,250,0.35)';
const PERSONAL_ON = '#7C4DFF';

const ADD_MODE_KEY = 'grocery_add_mode';
const DRAFT_TOGGLE_KEY = 'grocery_draft_toggle';
const REMINDER_PROMPT_DURATION_MS = 4000;
const MAX_CATEGORY_TILES = 4;
const STALE_KEPT_KEY = 'grocery_stale_kept';

function ItemSeparator(): React.JSX.Element {
  return <View style={separatorStyles.item} />;
}
function SectionSeparator(): React.JSX.Element {
  return <View style={separatorStyles.section} />;
}
const separatorStyles = StyleSheet.create({
  item: { height: ms(10) },
  section: { height: ms(24) },
});

// ── Screen ─────────────────────────────────────────────────────────────────────
interface GroceryItemWithMeta extends GroceryItem {
  isDuplicate?: boolean;
}
interface SectionData {
  title: string;
  icon: IoniconName;
  tone: CategoryTone;
  /** Category translation key — shared sections only. */
  labelKey?: string;
  data: GroceryItemWithMeta[];
  sectionType: 'draft' | 'private' | 'shared';
  /** True on the first ordered section that carries the "remind me" bell. */
  withReminder?: boolean;
}

function GroceryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();

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
  const memberName = useMemberName();
  // Ticks once a minute so "2h ago" / the 3-day amber pill stay current.
  const now = useNow();
  const myName = profile?.name ?? '';
  const draftEnabled = useSettingsStore((s) => s.isEnabled('grocery_draft'));

  const [itemName, setItemName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('shared');
  const [isDraftOn, setIsDraftOn] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
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
        tone: 'amber',
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
        tone: 'violet',
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
          tone: cat.tone,
          labelKey: stableKey,
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

  // Unticked items in the bucket the user is adding to (shared, private or draft).
  const inAddBucket = useCallback(
    (i: GroceryItem): boolean =>
      effectiveMode === 'private'
        ? i.isPersonal && !i.isDraft && i.addedBy === myId
        : effectiveMode === 'draft'
          ? i.isDraft && i.addedBy === myId
          : !i.isPersonal,
    [effectiveMode, myId]
  );

  const isOnList = useCallback(
    (name: string): boolean => {
      const key = name.trim().toLowerCase();
      return items.some(
        (i) => !i.isChecked && inAddBucket(i) && i.name.trim().toLowerCase() === key
      );
    },
    [items, inAddBucket]
  );

  /** Adds (or merges) one item. `addQty` is a language-neutral "<count><unit>". */
  const addEntry = useCallback(
    async (n: string, addQty: string, noteText: string): Promise<boolean> => {
      // addBusyRef is a synchronous lock: a double-fired press (common on web)
      // or a fast second tap is dropped instead of racing into a duplicate row.
      if (!n || addBusyRef.current) return false;
      addBusyRef.current = true;
      setIsAdding(true);
      setAddError(null);
      try {
        // Same-name unchecked item already on this list? Merge into it and bump
        // the quantity instead of creating a separate duplicate row — so "add
        // olive oil x3" becomes one item you can count down, not three rows.
        // Read the freshest list (not the render-time closure) so a just-added
        // item is seen and merged rather than duplicated.
        const currentItems = useGroceryStore.getState().items;
        const existing = currentItems.find(
          (i) => !i.isChecked && inAddBucket(i) && i.name.trim().toLowerCase() === n.toLowerCase()
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
          await addItem(n, addQty, myId, houseId ?? '', effectiveMode, noteText || undefined);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showAddedItemPrompt(n);
        return true;
      } catch {
        setAddError(t('grocery.could_not_add'));
        return false;
      } finally {
        addBusyRef.current = false;
        setIsAdding(false);
      }
    },
    [myId, houseId, addItem, updateItem, effectiveMode, inAddBucket, t, showAddedItemPrompt]
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
  const deletingIdsRef = useRef(new Set<string>());
  const onDelete = useCallback(
    (id: string): void => {
      if (deletingIdsRef.current.has(id)) return;
      deletingIdsRef.current.add(id);

      const doDelete = (): void => {
        setSelectedItem((cur) => (cur?.id === id ? null : cur));
        deleteItem(id)
          .catch(() => {
            Alert.alert(t('grocery.could_not_remove_item'), t('grocery.something_went_wrong'));
          })
          .finally(() => {
            deletingIdsRef.current.delete(id);
          });
      };
      const target = items.find((i) => i.id === id);
      // Anyone in the house can clear a shared item, but removing a housemate's
      // item gets a quick confirm so it can't vanish from a stray swipe.
      if (!target || target.addedBy === myId) {
        doDelete();
        return;
      }
      Alert.alert(
        t('grocery.remove_others_item_title', { name: target.name }),
        t('grocery.remove_others_item_body', { name: memberName(target.addedBy) }),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
            onPress: (): void => {
              deletingIdsRef.current.delete(id);
            },
          },
          { text: t('grocery.remove_confirm'), style: 'destructive', onPress: doDelete },
        ]
      );
    },
    [deleteItem, items, myId, memberName, t]
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
  // The add bar is the quick path: typed name + "+" adds one straight away.
  // An empty bar (or the options button) opens the sheet with the extra details.
  const handleAddPress = useCallback(async (): Promise<void> => {
    const n = itemName.trim();
    if (!n) {
      setShowAddSheet(true);
      return;
    }
    if (await addEntry(n, '1', '')) {
      setItemName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [itemName, addEntry]);
  const handleOpenAddSheet = useCallback((): void => {
    setShowAddSheet(true);
  }, []);
  const handleCloseAddSheet = useCallback((): void => {
    setShowAddSheet(false);
  }, []);
  const handleSheetAdd = useCallback(
    async (n: string, quantity: string, noteText: string): Promise<boolean> => {
      const ok = await addEntry(n, quantity, noteText);
      if (ok) setItemName('');
      return ok;
    },
    [addEntry]
  );

  const renderItem = useCallback(
    ({ item }: { item: GroceryItemWithMeta }): React.JSX.Element => (
      <GroceryItemRow
        item={item}
        myId={myId}
        now={now}
        isDuplicate={item.isDuplicate}
        onToggle={onToggle}
        onDelete={onDelete}
        onIncrement={onInc}
        onDecrement={onDec}
        onLongPress={handleLongPress}
      />
    ),
    [myId, now, onToggle, onDelete, onInc, onDec, handleLongPress]
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
          <Text style={[styles.sectionTitle, headingFont]} accessibilityRole="header">
            {section.title}
          </Text>
          <Text style={styles.sectionCount}>
            {t('grocery.section_count', { count: section.data.length })}
          </Text>
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
      headingFont,
    ]
  );

  const listRef = useRef<SectionList<GroceryItemWithMeta, SectionData>>(null);

  // Header summary: what's still to buy, and how much landed today.
  const { toGrabCount, addedTodayCount } = useMemo(() => {
    const visible = items.filter((i) => !i.isDraft || i.addedBy === myId);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    return {
      toGrabCount: visible.filter((i) => !i.isChecked).length,
      addedTodayCount: visible.filter(
        (i) => new Date(i.createdAt).getTime() >= startOfToday.getTime()
      ).length,
    };
  }, [items, myId, now]);

  // The busiest aisles, as tiles that jump to their section.
  const categoryTiles = useMemo((): CategoryTileData[] => {
    const tiles: CategoryTileData[] = [];
    sections.forEach((section, sectionIndex) => {
      if (section.sectionType !== 'shared' || !section.labelKey) return;
      const count = section.data.filter((i) => !i.isChecked).length;
      if (count === 0) return;
      tiles.push({
        labelKey: section.labelKey,
        icon: section.icon,
        tone: section.tone,
        count,
        sectionIndex,
      });
    });
    return tiles.sort((a, b) => b.count - a.count).slice(0, MAX_CATEGORY_TILES);
  }, [sections]);

  const handleJumpToSection = useCallback((sectionIndex: number): void => {
    Haptics.selectionAsync().catch(() => {});
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, viewOffset: ms(56) });
  }, []);
  // Sections far below may not be measured yet; nudge closer, then retry.
  const handleScrollFailed = useCallback(
    (info: { averageItemLength: number; index: number }): void => {
      listRef.current
        ?.getScrollResponder()
        ?.scrollTo({ y: info.averageItemLength * info.index, animated: true });
    },
    []
  );

  // "Still need it?" — the oldest shared item that's been waiting 3+ days and
  // nobody has said "keep it" to on this phone.
  const [keptStaleIds, setKeptStaleIds] = useState<string[]>([]);
  useEffect((): void => {
    AsyncStorage.getItem(STALE_KEPT_KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) setKeptStaleIds(parsed.filter((x) => typeof x === 'string'));
      })
      .catch(() => {});
  }, []);
  const staleItem = useMemo((): { id: string; name: string; days: number } | null => {
    const candidates = items
      .filter(
        (i) =>
          !i.isChecked &&
          !i.isPersonal &&
          !i.isDraft &&
          !keptStaleIds.includes(i.id) &&
          isItemStale(i.createdAt, now)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const oldest = candidates[0];
    if (!oldest) return null;
    const age = getItemAge(oldest.createdAt, now);
    return { id: oldest.id, name: oldest.name, days: age.unit === 'days' ? age.count : 3 };
  }, [items, keptStaleIds, now]);
  const handleKeepStale = useCallback((): void => {
    if (!staleItem) return;
    Haptics.selectionAsync().catch(() => {});
    // Only remember ids still on the list so the stored set can't grow forever.
    const liveIds = new Set(items.map((i) => i.id));
    const next = [...keptStaleIds.filter((id) => liveIds.has(id)), staleItem.id];
    setKeptStaleIds(next);
    AsyncStorage.setItem(STALE_KEPT_KEY, JSON.stringify(next)).catch(() => {});
  }, [staleItem, items, keptStaleIds]);
  const handleRemoveStale = useCallback((): void => {
    if (staleItem) onDelete(staleItem.id);
  }, [staleItem, onDelete]);

  const handleSelectDestination = useCallback(
    (dest: AddDestination): void => {
      if (dest === 'private') handleSetPrivate();
      else if (dest === 'draft') handleSelectDraft();
      else handleSelectShared();
    },
    [handleSetPrivate, handleSelectDraft, handleSelectShared]
  );

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
                ref={listRef}
                extraData={now}
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
                onScrollToIndexFailed={handleScrollFailed}
                ListHeaderComponent={
                  <View>
                    <BackLink label={t('common.home')} />
                    <GroceryHeader toGrabCount={toGrabCount} addedTodayCount={addedTodayCount} />

                    {/* ── Add bar: Enter adds straight away; "+" opens the details sheet ── */}
                    <View style={[styles.addBar, destPersonal && styles.addBarPersonal]}>
                      <TextInput
                        ref={inputRef}
                        value={itemName}
                        onChangeText={handleItemNameChange}
                        placeholder={t('grocery.add_bar_placeholder')}
                        placeholderTextColor={C.textTertiary}
                        style={styles.addInput}
                        returnKeyType="done"
                        blurOnSubmit={false}
                        onSubmitEditing={handleAddPress}
                        accessibilityLabel={t('grocery.add_item_a11y')}
                        accessibilityHint={t('grocery.add_item_hint')}
                      />
                      <Pressable
                        style={[
                          styles.addBtn,
                          destPersonal && styles.addBtnPersonal,
                          isAdding && styles.addBtnBusy,
                        ]}
                        onPress={handleOpenAddSheet}
                        disabled={isAdding}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isAdding }}
                        accessibilityLabel={t('grocery.add_item')}
                        accessibilityHint={t('grocery.add_more_details')}
                      >
                        {isAdding ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="add" size={26} color="#FFFFFF" />
                        )}
                      </Pressable>
                    </View>

                    {/* ── Where new items go: Shared | Personal | Draft ──── */}
                    <View style={styles.modeRow} accessibilityRole="radiogroup">
                      <Pressable
                        style={[styles.modePill, destShared && styles.modePillShared]}
                        onPress={handleSelectShared}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: destShared }}
                        accessibilityLabel={t('grocery.shared_tab')}
                      >
                        <Text style={[styles.modeText, destShared && styles.modeTextOn]}>
                          {t('grocery.shared_seg')}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modePill, destPersonal && styles.modePillPersonal]}
                        onPress={handleSetPrivate}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: destPersonal }}
                        accessibilityLabel={t('grocery.private_tab')}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={15}
                          color={destPersonal ? C.surface : C.textSecondary}
                        />
                        <Text style={[styles.modeText, destPersonal && styles.modeTextOn]}>
                          {t('grocery.personal_seg')}
                        </Text>
                      </Pressable>
                      {draftEnabled && (
                        <Pressable
                          style={[styles.modePill, destDraft && styles.modePillDraft]}
                          onPress={handleSelectDraft}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: destDraft }}
                          accessibilityLabel={t('grocery.draft_mode')}
                        >
                          <Text style={[styles.modeText, destDraft && styles.modeTextOn]}>
                            {t('grocery.draft_seg')}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {!!addError && (
                      <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{addError}</Text>
                      </View>
                    )}

                    {categoryTiles.length > 0 && (
                      <CategoryTiles tiles={categoryTiles} onPressTile={handleJumpToSection} />
                    )}

                    <ShoppingRunCard
                      activeRun={activeRun}
                      myId={myId}
                      onOpenShop={handleStartRun}
                      onEndRun={handleEndRun}
                      onQuickBuy={handleQuickBuy}
                    />

                    {staleItem && (
                      <StaleItemNudge
                        itemName={staleItem.name}
                        days={staleItem.days}
                        onKeep={handleKeepStale}
                        onRemove={handleRemoveStale}
                      />
                    )}

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
                  isLoading ? null : (
                    <View style={styles.emptyWrap}>
                      <View style={styles.emptyIconChip}>
                        <Ionicons name="basket-outline" size={34} color={C.primary} />
                      </View>
                      <Text style={styles.emptyTitle}>{t('grocery.empty')}</Text>
                      <Text style={styles.emptyText}>{t('grocery.empty_hint')}</Text>
                    </View>
                  )
                }
                ListFooterComponent={<View style={styles.bottomPad} />}
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
      <AddItemSheet
        visible={showAddSheet}
        initialName={itemName}
        destination={destPersonal ? 'private' : destDraft ? 'draft' : 'shared'}
        draftEnabled={draftEnabled}
        onSelectDestination={handleSelectDestination}
        isOnList={isOnList}
        isAdding={isAdding}
        onAdd={handleSheetAdd}
        onClose={handleCloseAddSheet}
      />

      <GroceryItemDetailModal
        item={selectedItem}
        visible={!!selectedItem}
        myId={myId}
        onClose={handleCloseModal}
        onSaveComment={onSaveComment}
        onUpdate={onUpdate}
        onDelete={onDelete}
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
  const isDark = C.background === darkColors.background;
  return StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1, backgroundColor: C.background },
    listContent: { paddingHorizontal: ms(16), paddingTop: ms(4), paddingBottom: ms(8) },
    reminderPromptOverlay: {
      position: 'absolute',
      top: ms(8),
      left: ms(16),
      right: ms(16),
    },

    // ── Add bar
    addBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(4),
      backgroundColor: C.surface,
      borderRadius: ms(30),
      paddingStart: ms(18),
      paddingEnd: ms(6),
      paddingVertical: ms(6),
      borderWidth: isDark ? 1 : 0,
      borderColor: C.border,
      shadowColor: '#1F2A44',
      shadowOffset: { width: 0, height: ms(6) },
      shadowOpacity: isDark ? 0 : 0.08,
      shadowRadius: 16,
      elevation: isDark ? 0 : 3,
    },
    addBarPersonal: { backgroundColor: isDark ? 'rgba(124,58,237,0.14)' : '#F6F1FD' },
    addInput: {
      flex: 1,
      minWidth: 0,
      height: ms(46),
      fontSize: mf(16),
      ...font.regular,
      color: C.textPrimary,
    },
    addBtn: {
      width: ms(48),
      height: ms(48),
      borderRadius: ms(24),
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addBtnPersonal: { backgroundColor: PERSONAL_ON },
    addBtnBusy: { opacity: 0.7 },

    // ── Mode pills
    modeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: ms(8),
      marginTop: ms(14),
      marginBottom: ms(18),
    },
    modePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(6),
      minHeight: ms(40),
      paddingHorizontal: ms(16),
      borderRadius: ms(20),
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
    },
    modePillShared: { backgroundColor: C.textPrimary, borderColor: C.textPrimary },
    modePillPersonal: { backgroundColor: C.textPrimary, borderColor: C.textPrimary },
    modePillDraft: { backgroundColor: C.textPrimary, borderColor: C.textPrimary },
    modeText: { fontSize: mf(14), ...font.semibold, color: C.textSecondary },
    modeTextOn: { color: C.surface },

    // ── Section headers
    sectionBell: {
      marginStart: ms(4),
      width: ms(36),
      height: ms(36),
      borderRadius: ms(18),
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
    catTitle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ms(8),
      paddingHorizontal: ms(4),
      paddingTop: ms(4),
      paddingBottom: ms(10),
    },
    sectionTitle: { flex: 1, fontSize: mf(20), color: C.textPrimary, letterSpacing: -0.2 },
    sectionCount: { fontSize: mf(13), ...font.medium, color: C.textSecondary },
    catTitlePersonal: {
      backgroundColor: PERSONAL_BG,
      borderRadius: ms(12),
      paddingHorizontal: ms(12),
      paddingVertical: ms(8),
      marginBottom: ms(10),
      borderWidth: 1,
      borderColor: PERSONAL_BORDER,
    },
    catTitleDraftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: ms(8),
      gap: ms(8),
    },
    catTitleFlex: { flex: 1 },
    catTitleText: { fontSize: mf(15), ...font.bold, color: C.textPrimary },
    catTitleTextDraft: { color: isDark ? '#E8C77E' : 'rgb(133,77,14)' },
    catTitleTextPersonal: { color: isDark ? 'rgb(196,181,253)' : 'rgb(76,29,149)' },
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

    loadingIndicator: { marginBottom: ms(8) },
    errorBanner: {
      backgroundColor: C.dangerTint,
      borderRadius: ms(14),
      padding: ms(12),
      marginBottom: ms(12),
    },
    errorBannerText: { fontSize: mf(13), color: C.danger },

    emptyWrap: { alignItems: 'center', paddingVertical: ms(40), gap: ms(8) },
    emptyIconChip: {
      width: ms(72),
      height: ms(72),
      borderRadius: ms(24),
      backgroundColor: C.primaryTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: ms(8),
    },
    emptyTitle: { fontSize: mf(17), ...font.bold, color: C.textPrimary, textAlign: 'center' },
    emptyText: {
      fontSize: mf(14),
      ...font.regular,
      color: C.textSecondary,
      textAlign: 'center',
      maxWidth: ms(280),
    },

    clearBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: ms(16),
      paddingVertical: ms(12),
      minHeight: ms(44),
      borderRadius: ms(22),
      marginHorizontal: ms(16),
      marginTop: ms(8),
      marginBottom: ms(4),
      backgroundColor: C.successTint,
    },
    clearBarWrap: { overflow: 'hidden' },
    clearBarLeft: { flexDirection: 'row', alignItems: 'center', gap: ms(6) },
    clearBarCount: { fontSize: mf(14), ...font.semibold, color: C.positive },
    clearBarAction: { fontSize: mf(13), ...font.bold, color: C.positive },

    bottomPad: { height: sizes.bottomTabContentPadding },
  });
}

export default withFeatureGuard('grocery', GroceryScreen);
