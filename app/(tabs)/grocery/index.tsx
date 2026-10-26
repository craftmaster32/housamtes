import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useScrollToTopOnNav } from '@hooks/useScrollToTopOnNav';
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
import { useThemedColors, type ColorTokens } from '@constants/colors';
import { useMemberName } from '@hooks/useMemberName';
import { useNow } from '@hooks/useNow';
import { LoadingSpinner } from '@components/shared/LoadingSpinner';
import { BackLink } from '@components/shared/BackLink';
import { GroceryItemRow } from '@components/grocery/GroceryItemRow';
import { ShoppingRunCard } from '@components/grocery/ShoppingRunCard';
import { AddItemSheet, type AddDestination } from '@components/grocery/AddItemSheet';
import { StaleItemNudge } from '@components/grocery/StaleItemNudge';
import { Fold } from '@components/shared/Fold';
import { useStaleNudge } from '@hooks/useStaleNudge';
import { useFoldAway } from '@hooks/useFoldAway';
import { GroceryItemDetailModal } from '@components/grocery/GroceryItemDetailModal';
import { SaveListModal, type SaveListMode } from '@components/grocery/SaveListModal';
import {
  GroceryListEditorModal,
  type ListEditorMode,
} from '@components/grocery/GroceryListEditorModal';
import { LeaveWithoutShareModal } from '@components/grocery/LeaveWithoutShareModal';
import { SavedListsSheet } from '@components/grocery/SavedListsSheet';
import { SavedListsTile } from '@components/grocery/SavedListsTile';
import { AddStrip } from '@components/grocery/AddStrip';
import { BagSlice } from '@components/grocery/BagSlice';
import { AisleSign } from '@components/grocery/AisleSign';
import { ReminderClip } from '@components/grocery/ReminderClip';
import { ChoiceWords, type ChoiceWord } from '@components/settings/ChoiceWords';
import { Mate } from '@components/shared/Mate';
import { MateCameo } from '@components/shared/MateCameo';
import { MateSpot } from '@components/shared/MateSpot';
import { useMateScene } from '@hooks/useMateScene';
import { useHandFont } from '@hooks/useHandFont';
import { GroceryReminderModal } from '@components/grocery/GroceryReminderModal';
import { ReminderPromptBanner } from '@components/grocery/ReminderPromptBanner';
import { useAddedItemPrompt } from '@hooks/useAddedItemPrompt';
import { font } from '@constants/typography';
import { sizes } from '@constants/sizes';
import { getErrorMessage } from '@utils/errors';
import { detectCategory, type CategoryTone } from '@utils/groceryCategory';
import { useHeadingFont } from '@hooks/useHeadingFont';
import type { IoniconName } from '@/types/icons';

import { mf, ms } from '@utils/responsive';

const ADD_MODE_KEY = 'grocery_add_mode';
const DRAFT_TOGGLE_KEY = 'grocery_draft_toggle';
const REMINDER_PROMPT_DURATION_MS = 4000;

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
  // Tapping your way here (even from this page) shows the top of the page.
  const scrollRef = useScrollToTopOnNav('grocery/index');
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
  const deleteReminder = useGroceryStore((s) => s.deleteReminder);

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
  const headingFont = useHeadingFont('semibold');
  const handFont = useHandFont();

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
  const destPersonal = addMode === 'private';
  const destDraft = addMode === 'shared' && isDraftOn && draftEnabled;
  const checked = useMemo(() => items.filter((i) => i.isChecked), [items]);
  const { foldingIds, foldAway } = useFoldAway();

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
  // An empty bag already has its own Mate, so he only hides when there's a list.
  const mateSpot = useMateScene(MATE_SPOTS, sections.length > 0);

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

  const [showSavedLists, setShowSavedLists] = useState(false);
  const handleOpenSavedLists = useCallback((): void => setShowSavedLists(true), []);
  const handleCloseSavedLists = useCallback((): void => setShowSavedLists(false), []);
  // Loading a list fills the draft on the page, so close the sheet to show it.
  const handleLoadListFromSheet = useCallback(
    async (list: GroceryList): Promise<void> => {
      setShowSavedLists(false);
      await handleLoadList(list);
    },
    [handleLoadList]
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

  const handleDeleteReminder = useCallback(
    (id: string): void => {
      deleteReminder(id).catch(() => {
        Alert.alert(t('common.error'), t('grocery.something_went_wrong'));
      });
    },
    [deleteReminder, t]
  );

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
    // The ticked rows fold away first, then they're removed.
    foldAway(
      checked.map((i) => i.id),
      () =>
        clearChecked(houseId).catch(() => {
          Alert.alert(t('grocery.could_not_clear'), t('grocery.something_went_wrong'));
        })
    );
  }, [clearChecked, houseId, t, foldAway, checked]);
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
  // The add strip is the quick path: typed name + amount/unit + "+" adds it
  // straight away. An empty strip (or a long-press on +) opens the details sheet.
  const handleStripAdd = useCallback(
    async (quantity: string): Promise<boolean> => {
      const n = itemName.trim();
      if (!n) return false;
      const ok = await addEntry(n, quantity, '');
      if (ok) {
        setItemName('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      return ok;
    },
    [itemName, addEntry]
  );
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

  const {
    nudge,
    isOpen: nudgeOpen,
    appear: nudgeAppear,
    handleKeep: handleKeepStale,
    handleRemove: handleRemoveStale,
    handleClosed: handleNudgeClosed,
  } = useStaleNudge(items, now, onDelete);

  const renderItem = useCallback(
    ({ item, index }: { item: GroceryItemWithMeta; index: number }): React.JSX.Element => (
      <Fold open={!foldingIds.has(item.id)}>
        <BagSlice dashedTop={index > 0}>
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
          {nudge?.id === item.id && (
            <Fold open={nudgeOpen} appear={nudgeAppear} onClosed={handleNudgeClosed}>
              <StaleItemNudge
                itemName={nudge.name}
                days={nudge.days}
                onKeep={handleKeepStale}
                onRemove={handleRemoveStale}
              />
            </Fold>
          )}
        </BagSlice>
      </Fold>
    ),
    [
      myId,
      now,
      foldingIds,
      onToggle,
      onDelete,
      onInc,
      onDec,
      handleLongPress,
      nudge,
      nudgeOpen,
      nudgeAppear,
      handleKeepStale,
      handleRemoveStale,
      handleNudgeClosed,
    ]
  );

  const renderSectionSign = useCallback(
    ({ section }: { section: SectionData }): React.JSX.Element => {
      const sectionIndex = sections.indexOf(section);
      const isTop = sectionIndex === 0;
      // The bag's opening, with the reminders clipped to its corner, sits on top
      // of whichever section comes first.
      const top = isTop ? (
        <ReminderClip count={reminders.length} onPress={handleOpenGeneralReminder} />
      ) : null;

      if (section.sectionType === 'draft') {
        const doneDisabled = isPublishing || !myId || !houseId;
        return (
          <BagSlice isTop={isTop}>
            {top}
            <AisleSign title={section.title} icon={section.icon} tone={section.tone}>
              <Pressable
                style={[styles.signBtn, doneDisabled && styles.signBtnOff]}
                onPress={handleKeepDraftPrivate}
                disabled={doneDisabled}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: doneDisabled }}
                accessibilityLabel={t('grocery.keep_draft_private_a11y')}
                accessibilityHint={t('grocery.keep_draft_private_a11y_hint')}
              >
                <Ionicons name="lock-closed" size={18} color={C.kraftInk} />
              </Pressable>
              <Pressable
                style={[styles.signBtn, styles.signBtnShare, doneDisabled && styles.signBtnOff]}
                onPress={handlePublishDraft}
                disabled={doneDisabled}
                accessible
                accessibilityRole="button"
                accessibilityState={{ disabled: doneDisabled }}
                accessibilityLabel={t('grocery.share_draft_a11y')}
                accessibilityHint={t('grocery.share_draft_a11y_hint')}
              >
                {isPublishing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            </AisleSign>
          </BagSlice>
        );
      }
      return (
        <BagSlice isTop={isTop}>
          {top}
          <AisleSign
            title={section.title}
            icon={section.icon}
            tone={section.sectionType === 'private' ? 'violet' : section.tone}
            leanRight={sectionIndex % 2 === 1}
          />
        </BagSlice>
      );
    },
    [
      sections,
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
  // An aisle whose items are all being cleared folds its sign away with them.
  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }): React.JSX.Element => (
      <Fold open={!section.data.every((i) => foldingIds.has(i.id))}>
        {renderSectionSign({ section })}
      </Fold>
    ),
    [renderSectionSign, foldingIds]
  );

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

  const destination: AddDestination = destPersonal ? 'private' : destDraft ? 'draft' : 'shared';
  const destinationWords = useMemo<ChoiceWord<AddDestination>[]>(
    () => [
      { value: 'shared', label: t('grocery.shared_seg') },
      { value: 'private', label: t('grocery.personal_seg') },
      ...(draftEnabled ? [{ value: 'draft' as const, label: t('grocery.draft_seg') }] : []),
    ],
    [t, draftEnabled]
  );

  return (
    <>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.root} edges={['top']}>
          <SectionList
            ref={scrollRef}
            extraData={now}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                <BackLink label={t('common.home')} />
                <Text style={[styles.title, headingFont]} accessibilityRole="header">
                  {t('grocery.header_title')}
                </Text>

                <AddStrip
                  value={itemName}
                  onChangeText={handleItemNameChange}
                  inputRef={inputRef}
                  isAdding={isAdding}
                  onAdd={handleStripAdd}
                  onOpenDetails={handleOpenAddSheet}
                />
                <ChoiceWords
                  options={destinationWords}
                  selected={destination}
                  onSelect={handleSelectDestination}
                  groupLabel={t('grocery.add_item')}
                />

                {!!addError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{addError}</Text>
                  </View>
                )}

                {/* Before the tiles so they hide his lower half. */}
                {mateSpot === 'peekOver' && (
                  <View style={mateStyles.behind}>
                    <MateSpot kind="peekOver" size={ms(38)} style={mateStyles.peek} />
                  </View>
                )}
                <View style={styles.tiles}>
                  <ShoppingRunCard
                    activeRun={activeRun}
                    myId={myId}
                    onOpenShop={handleStartRun}
                    onEndRun={handleEndRun}
                    onQuickBuy={handleQuickBuy}
                  />
                  <SavedListsTile count={savedLists.length} onPress={handleOpenSavedLists} />
                </View>

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
                <BagSlice isTop isBottom>
                  <ReminderClip count={reminders.length} onPress={handleOpenGeneralReminder} />
                  <View style={styles.emptyWrap}>
                    <Mate size={ms(76)} />
                    <Text style={[styles.emptyTitle, headingFont]}>{t('grocery.empty')}</Text>
                    <Text style={styles.emptyText}>{t('grocery.empty_hint')}</Text>
                  </View>
                </BagSlice>
              )
            }
            ListFooterComponent={
              <View>
                {sections.length > 0 && (
                  <BagSlice isBottom dashedTop>
                    <View style={styles.bagFoot}>
                      <Text style={[styles.checkedCount, handFont]}>
                        {checked.length > 0
                          ? t('grocery.checked_count', { count: checked.length })
                          : ''}
                      </Text>
                      {checked.length > 0 && (
                        <Pressable
                          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
                          onPress={handleClear}
                          accessible
                          accessibilityRole="button"
                          accessibilityLabel={t('grocery.clear_items_a11y', {
                            count: checked.length,
                          })}
                        >
                          <Text style={styles.clearText}>{t('grocery.clear_checked')}</Text>
                        </Pressable>
                      )}
                    </View>
                  </BagSlice>
                )}
                {mateSpot === 'footer' && <MateCameo page="grocery" always />}
                <View style={styles.bottomPad} />
              </View>
            }
          />

          <View style={styles.reminderPromptOverlay} pointerEvents="box-none">
            <ReminderPromptBanner
              itemName={addedItemName}
              onSet={handleSetReminderForAddedItem}
              onDismiss={dismissAddedItemPrompt}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <SavedListsSheet
        visible={showSavedLists}
        onClose={handleCloseSavedLists}
        lists={savedLists}
        isLoading={isLoadingLists}
        myId={myId}
        hasDraftItems={myDraftItems.length > 0}
        onLoadList={handleLoadListFromSheet}
        onDeleteList={handleDeleteList}
        onCreateList={handleOpenCreateList}
        onEditList={handleOpenEditList}
      />

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
        reminders={reminders}
        onDelete={handleDeleteReminder}
        onClose={handleCloseReminderModal}
        onSave={handleSaveReminder}
      />
    </>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
function makeStyles(C: ColorTokens): ReturnType<typeof StyleSheet.create> {
  return StyleSheet.create({
    flex: { flex: 1 },
    root: { flex: 1, backgroundColor: C.background },
    listContent: { paddingHorizontal: ms(20), paddingTop: ms(4), paddingBottom: ms(8) },
    reminderPromptOverlay: { position: 'absolute', top: ms(8), left: ms(16), right: ms(16) },
    title: {
      fontSize: mf(36),
      // Tall enough for the descenders, so no letter is clipped.
      lineHeight: mf(46),
      paddingBottom: ms(2),
      letterSpacing: -0.5,
      marginTop: ms(4),
      color: C.textPrimary,
    },
    tiles: { flexDirection: 'row', gap: ms(12), marginTop: ms(10), marginBottom: ms(18) },

    // Draft section: keep private / share, as round buttons beside its sign.
    signBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.8,
      borderColor: C.kraftInk,
      alignItems: 'center',
      justifyContent: 'center',
    },
    signBtnShare: { backgroundColor: '#3B6FBF', borderColor: '#3B6FBF' },
    signBtnOff: { opacity: 0.35 },

    bagFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingTop: ms(6),
    },
    checkedCount: { fontSize: mf(20), color: C.kraftMuted },
    clearBtn: { minHeight: 44, justifyContent: 'center' },
    clearText: { fontSize: mf(15), ...font.semibold, color: '#B84540' },
    pressed: { opacity: 0.6 },

    loadingIndicator: { marginBottom: ms(8) },
    errorBanner: {
      backgroundColor: C.dangerTint,
      borderRadius: ms(14),
      padding: ms(12),
      marginTop: ms(10),
    },
    errorBannerText: { fontSize: mf(13.5), color: C.danger },

    emptyWrap: { alignItems: 'center', paddingVertical: ms(26), gap: ms(8) },
    emptyTitle: { fontSize: mf(20), lineHeight: mf(26), color: C.kraftInk, textAlign: 'center' },
    emptyText: {
      fontSize: mf(14.5),
      ...font.regular,
      color: C.kraftMuted,
      textAlign: 'center',
      lineHeight: mf(20),
      paddingHorizontal: ms(12),
    },
    bottomPad: { height: sizes.bottomTabContentPadding },
  });
}

export default withFeatureGuard('grocery', GroceryScreen);

// Where Mate may hide on a visit: peeking over the Saved Lists tile, or under
// the bag.
const MATE_SPOTS = ['peekOver', 'footer'] as const;

const mateStyles = StyleSheet.create({
  behind: { height: 0 },
  peek: { end: ms(40), top: -ms(26) },
});
