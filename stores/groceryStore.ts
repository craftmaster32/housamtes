import { create } from 'zustand';
import { z } from 'zod';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { useAuthStore } from '@stores/authStore';
import { notifyHousemates } from '@lib/notifyHousemates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureError } from '@lib/errorTracking';

const ACTIVE_RUN_KEY = 'grocery_active_run';
const RUN_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const DRAFT_EXPIRES_MS = 24 * 60 * 60 * 1000;

export type AddMode = 'shared' | 'draft' | 'private';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  boughtCount: number;
  addedBy: string;
  isChecked: boolean;
  createdAt: string;
  isPersonal: boolean;
  isDraft: boolean;
  comment?: string;
  draftExpiresAt?: string;
}

export interface SavedListItem {
  name: string;
  quantity: string;
}

interface GroceryListItem {
  id: string;
  listId: string;
  name: string;
  quantity: string;
  position: number;
}

export interface GroceryList {
  id: string;
  houseId: string;
  name: string;
  createdBy: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  items: GroceryListItem[];
}

interface ShoppingRun {
  shopperId: string;
  shopperName: string;
  startedAt: string;
}

export interface GroceryReminder {
  id: string;
  houseId: string;
  userId: string;
  listId: string | null;
  label: string;
  remindAt: string;
  sent: boolean;
  createdAt: string;
}

interface RunPayload {
  active: boolean;
  shopperId: string;
  shopperName: string;
  startedAt: string;
}

interface GroceryStore {
  items: GroceryItem[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  activeRun: ShoppingRun | null;
  savedLists: GroceryList[];
  isLoadingLists: boolean;
  listsError: string | null;
  currentDraftSourceListId: string | null;
  clearVersion: number;
  reminders: GroceryReminder[];
  isLoadingReminders: boolean;
  remindersError: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addItem: (
    name: string,
    quantity: string,
    addedByUserId: string,
    houseId: string,
    mode?: AddMode
  ) => Promise<void>;
  updateItem: (id: string, name: string, quantity: string) => Promise<void>;
  addComment: (id: string, comment: string) => Promise<void>;
  toggleItem: (id: string) => Promise<void>;
  incrementBought: (id: string) => Promise<void>;
  decrementBought: (id: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  clearChecked: (houseId: string) => Promise<void>;
  publishDraftItems: (userId: string, houseId: string) => Promise<void>;
  startRun: (shopperId: string, shopperName: string) => Promise<void>;
  endRun: () => Promise<void>;
  fetchSavedLists: (houseId: string) => Promise<void>;
  createSavedList: (
    name: string,
    houseId: string,
    userId: string,
    items: SavedListItem[],
    isPrivate?: boolean,
    displayName?: string
  ) => Promise<void>;
  updateSavedList: (listId: string, items: SavedListItem[]) => Promise<void>;
  deleteSavedList: (listId: string) => Promise<void>;
  loadListIntoDraft: (list: GroceryList, userId: string, houseId: string) => Promise<void>;
  setCurrentDraftSourceListId: (id: string | null) => void;
  fetchReminders: (houseId: string, userId: string) => Promise<void>;
  createReminder: (params: {
    houseId: string;
    userId: string;
    listId?: string | null;
    label: string;
    remindAt: string;
  }) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

function mapItem(r: Record<string, unknown>): GroceryItem {
  return {
    id: r.id as string,
    name: r.name as string,
    quantity: (r.quantity as string) ?? '',
    boughtCount: (r.bought_count as number) ?? 0,
    addedBy: r.added_by as string,
    isChecked: r.is_checked as boolean,
    createdAt: r.created_at as string,
    isPersonal: (r.is_personal as boolean) ?? false,
    isDraft: (r.is_draft as boolean) ?? false,
    comment: (r.comment as string) ?? undefined,
    draftExpiresAt: (r.draft_expires_at as string) ?? undefined,
  };
}

const createSavedListSchema = z.object({
  name: z.string().trim().min(1),
  houseId: z.string().uuid(),
  userId: z.string().uuid(),
  isPrivate: z.boolean(),
  displayName: z.string().trim(),
  items: z.array(z.object({ name: z.string().trim().min(1), quantity: z.string() })),
});

const createGroceryListResultSchema = z.object({
  id: z.string().uuid(),
  house_id: z.string().uuid(),
  name: z.string(),
  created_by: z.string(),
  is_private: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const createReminderSchema = z.object({
  houseId: z.string().uuid(),
  userId: z.string().uuid(),
  listId: z.string().uuid().nullable(),
  label: z.string().trim().min(1).max(200),
  remindAt: z
    .string()
    .datetime({ message: 'Invalid reminder time' })
    .refine((v) => new Date(v).getTime() > Date.now(), {
      message: 'Reminder time must be in the future',
    }),
});

function mapReminder(r: Record<string, unknown>): GroceryReminder {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    userId: r.user_id as string,
    listId: (r.list_id as string) ?? null,
    label: r.label as string,
    remindAt: r.remind_at as string,
    sent: (r.sent as boolean) ?? false,
    createdAt: r.created_at as string,
  };
}

export const useGroceryStore = create<GroceryStore>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      activeRun: null,
      savedLists: [],
      isLoadingLists: false,
      listsError: null,
      currentDraftSourceListId: null,
      clearVersion: 0,
      reminders: [],
      isLoadingReminders: false,
      remindersError: null,

      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[grocery] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          try {
            const stored = await AsyncStorage.getItem(ACTIVE_RUN_KEY);
            if (stored) {
              const run = JSON.parse(stored) as ShoppingRun;
              if (Date.now() - new Date(run.startedAt).getTime() < RUN_MAX_AGE_MS) {
                set({ activeRun: run });
              } else {
                AsyncStorage.removeItem(ACTIVE_RUN_KEY).catch(() => {});
              }
            }
          } catch {
            /* ignore storage errors */
          }

          const versionAtStart = get().clearVersion;
          const { data, error } = await supabase
            .from('grocery_items')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const fetchedItems: GroceryItem[] = (data ?? []).map((r) =>
            mapItem(r as Record<string, unknown>)
          );
          // A clear completed while this fetch was in-flight: the fetched data is
          // stale (DB had the items when the request started). Filter them out so
          // a concurrent loadGrocery call can never restore items that were just
          // cleared, regardless of which async operation completes last.
          const cleared = get().clearVersion !== versionAtStart;
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({
            items: cleared ? fetchedItems.filter((i) => !i.isChecked) : fetchedItems,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          captureError(err, {
            store: 'grocery',
            houseId,
            userId: useAuthStore.getState().user?.id ?? '',
          });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load groceries. Please try again.' });
        }

        // Superseded by a newer load or an unsubscribe while fetching — leave the
        // existing subscription (if any) untouched and never recreate one here.
        if (seq !== _loadSeq) return;
        // Already subscribed for this house: realtime-triggered reloads must not
        // tear the channel down and recreate it on every event.
        if (_channel && _channelHouseId === houseId) return;
        if (_channel) {
          supabase.removeChannel(_channel);
        }
        _channelHouseId = houseId;
        _channel = supabase
          .channel(`grocery:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'grocery_items',
              filter: `house_id=eq.${houseId}`,
            },
            (payload: { new: Record<string, unknown> }) => {
              const incoming = mapItem(payload.new);
              const current = get().items;
              if (!current.find((i) => i.id === incoming.id)) {
                set({ items: [incoming, ...current] });
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'grocery_items',
              filter: `house_id=eq.${houseId}`,
            },
            (payload: { new: Record<string, unknown> }) => {
              const updated = mapItem(payload.new);
              set({ items: get().items.map((i) => (i.id === updated.id ? updated : i)) });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'grocery_items',
              filter: `house_id=eq.${houseId}`,
            },
            (payload: { old: Record<string, unknown> }) => {
              const deletedId = payload.old.id as string;
              if (deletedId) {
                set({ items: get().items.filter((i) => i.id !== deletedId) });
              }
            }
          )
          .on('broadcast', { event: 'shopping_run' }, (msg: { payload: unknown }) => {
            const p = msg.payload as RunPayload;
            const newRun = p.active
              ? { shopperId: p.shopperId, shopperName: p.shopperName, startedAt: p.startedAt }
              : null;
            set({ activeRun: newRun });
            if (p.active && newRun) {
              AsyncStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(newRun)).catch(() => {});
            } else {
              AsyncStorage.removeItem(ACTIVE_RUN_KEY).catch(() => {});
            }
          })
          .subscribe();
      },

      unsubscribe: (): void => {
        // Invalidate any in-flight load so it cannot resubscribe after this cleanup.
        _loadSeq++;
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
          _channelHouseId = null;
        }
      },

      addItem: async (name, quantity, addedByUserId, houseId, mode = 'shared'): Promise<void> => {
        const isPersonal = mode !== 'shared';
        const isDraft = mode === 'draft';
        const draftExpiresAt = isDraft
          ? new Date(Date.now() + DRAFT_EXPIRES_MS).toISOString()
          : null;
        const { data, error } = await supabase
          .from('grocery_items')
          .insert({
            house_id: houseId,
            name,
            quantity,
            added_by: addedByUserId,
            is_personal: isPersonal,
            is_draft: isDraft,
            ...(draftExpiresAt ? { draft_expires_at: draftExpiresAt } : {}),
          })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'add-grocery', houseId });
          throw new Error('Could not add the item. Please try again.');
        }
        const item: GroceryItem = mapItem(data as Record<string, unknown>);
        set({ items: [item, ...get().items] });
      },

      addComment: async (id, comment): Promise<void> => {
        try {
          const { error } = await supabase.from('grocery_items').update({ comment }).eq('id', id);
          if (error) throw error;
          set({ items: get().items.map((i) => (i.id === id ? { ...i, comment } : i)) });
        } catch (err) {
          captureError(err, { context: 'grocery-comment' });
          throw new Error('Could not save note. Please try again.');
        }
      },

      updateItem: async (id, name, quantity): Promise<void> => {
        const { error } = await supabase
          .from('grocery_items')
          .update({ name, quantity })
          .eq('id', id);
        if (error) {
          captureError(error, { context: 'update-grocery' });
          throw new Error('Could not update the item. Please try again.');
        }
        set({ items: get().items.map((i) => (i.id === id ? { ...i, name, quantity } : i)) });
      },

      toggleItem: async (id): Promise<void> => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const newChecked = !item.isChecked;
        set({ items: get().items.map((i) => (i.id === id ? { ...i, isChecked: newChecked } : i)) });
        const { error } = await supabase
          .from('grocery_items')
          .update({ is_checked: newChecked })
          .eq('id', id);
        if (error) {
          set({
            items: get().items.map((i) => (i.id === id ? { ...i, isChecked: !newChecked } : i)),
          });
          captureError(error, { context: 'toggle-grocery-item', id });
        }
      },

      incrementBought: async (id): Promise<void> => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const max = parseInt(item.quantity, 10);
        const hasMax = !isNaN(max) && max > 1;
        const count = hasMax
          ? Math.min((item.boughtCount ?? 0) + 1, max)
          : (item.boughtCount ?? 0) + 1;
        const isChecked = hasMax ? count >= max : item.isChecked;
        const prev = { boughtCount: item.boughtCount, isChecked: item.isChecked };
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, boughtCount: count, isChecked } : i
          ),
        });
        const { error } = await supabase
          .from('grocery_items')
          .update({ bought_count: count, is_checked: isChecked })
          .eq('id', id);
        if (error) {
          set({ items: get().items.map((i) => (i.id === id ? { ...i, ...prev } : i)) });
          captureError(error, { context: 'increment-bought', id });
        }
      },

      decrementBought: async (id): Promise<void> => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return;
        const count = Math.max((item.boughtCount ?? 0) - 1, 0);
        const max = parseInt(item.quantity, 10);
        const hasMax = !isNaN(max) && max > 1;
        const isChecked = hasMax ? count >= max : item.isChecked;
        const prev = { boughtCount: item.boughtCount, isChecked: item.isChecked };
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, boughtCount: count, isChecked } : i
          ),
        });
        const { error } = await supabase
          .from('grocery_items')
          .update({ bought_count: count, is_checked: isChecked })
          .eq('id', id);
        if (error) {
          set({ items: get().items.map((i) => (i.id === id ? { ...i, ...prev } : i)) });
          captureError(error, { context: 'decrement-bought', id });
        }
      },

      deleteItem: async (id): Promise<void> => {
        const prevItems = get().items;
        set({ items: prevItems.filter((i) => i.id !== id) });
        const { error } = await supabase.from('grocery_items').delete().eq('id', id);
        if (error) {
          set({ items: prevItems });
          captureError(error, { context: 'delete-grocery-item', id });
          throw new Error('Could not delete the item. Please try again.');
        }
      },

      clearChecked: async (houseId: string): Promise<void> => {
        const parsedHouseId = z.string().uuid().safeParse(houseId);
        if (!parsedHouseId.success) return;
        const prevItems = get().items;
        const removedItems = prevItems.filter((i) => i.isChecked);
        if (removedItems.length === 0) return;
        const removedIds = removedItems.map((i) => i.id);
        try {
          set({ items: prevItems.filter((i) => !i.isChecked) });
          // Delete by specific IDs, not by is_checked flag — avoids a race where
          // toggleItem's DB update hasn't committed yet so is_checked is still false
          // in the DB at the moment clearChecked runs.
          const { error } = await supabase.from('grocery_items').delete().in('id', removedIds);
          if (error) throw error;
          // Increment clearVersion and re-apply. Any load() whose fetch started before
          // this delete will see the version mismatch and filter checked items from its
          // stale result, regardless of which async operation completes last.
          set({
            items: get().items.filter((i) => !i.isChecked),
            clearVersion: get().clearVersion + 1,
          });
        } catch (err) {
          // Restore only the removed items into the current state, not the full
          // prevItems snapshot — a concurrent load() may have added new items.
          const currentItems = get().items;
          const currentIds = new Set(currentItems.map((i) => i.id));
          const toRestore = removedItems.filter((i) => !currentIds.has(i.id));
          set({ items: [...currentItems, ...toRestore] });
          captureError(err, { context: 'clear-checked-grocery', houseId: parsedHouseId.data });
          throw new Error('Could not clear checked items. Please try again.');
        }
      },

      publishDraftItems: async (userId: string, houseId: string): Promise<void> => {
        const draftIds = get()
          .items.filter((i) => i.isDraft && i.addedBy === userId)
          .map((i) => i.id);
        if (draftIds.length === 0) return;
        try {
          const { error } = await supabase
            .from('grocery_items')
            .update({ is_personal: false, is_draft: false, draft_expires_at: null })
            .in('id', draftIds)
            .eq('house_id', houseId)
            .eq('added_by', userId)
            .eq('is_draft', true);
          if (error) {
            captureError(error, { context: 'publish-draft', userId });
            throw new Error('Could not share your list. Please try again.');
          }
          set({
            items: get().items.map((i) =>
              draftIds.includes(i.id) && i.addedBy === userId
                ? { ...i, isPersonal: false, isDraft: false, draftExpiresAt: undefined }
                : i
            ),
            currentDraftSourceListId: null,
          });

          // Notify housemates (non-fatal)
          notifyHousemates({
            houseId,
            excludeUserId: userId,
            title: '🛒 Shopping list incoming!',
            body: `${draftIds.length} item${draftIds.length === 1 ? '' : 's'} added. Time to brave the shops 💪`,
            notificationType: 'grocery_shared',
            data: { screen: 'grocery' },
          }).catch(() => {});
        } catch (err) {
          captureError(err, { context: 'publish-draft-exception', userId });
          throw err instanceof Error
            ? err
            : new Error('Could not share your list. Please try again.');
        }
      },

      startRun: async (shopperId: string, shopperName: string): Promise<void> => {
        const startedAt = new Date().toISOString();
        const run: ShoppingRun = { shopperId, shopperName, startedAt };
        set({ activeRun: run });
        AsyncStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(run)).catch(() => {});
        _channel
          ?.send({
            type: 'broadcast',
            event: 'shopping_run',
            payload: { active: true, shopperId, shopperName, startedAt },
          })
          .catch(() => {});
      },

      endRun: async (): Promise<void> => {
        set({ activeRun: null });
        AsyncStorage.removeItem(ACTIVE_RUN_KEY).catch(() => {});
        _channel
          ?.send({
            type: 'broadcast',
            event: 'shopping_run',
            payload: { active: false, shopperId: '', shopperName: '', startedAt: '' },
          })
          .catch(() => {});
      },

      // ── Saved Lists ──────────────────────────────────────────────────────────

      fetchSavedLists: async (houseId: string): Promise<void> => {
        set({ isLoadingLists: true });
        try {
          const { data, error } = await supabase
            .from('grocery_lists')
            .select('*, items:grocery_list_items(*)')
            .eq('house_id', houseId)
            .order('updated_at', { ascending: false });
          if (error) throw error;
          const lists: GroceryList[] = (data ?? []).map((r) => ({
            id: r.id as string,
            houseId: r.house_id as string,
            name: r.name as string,
            createdBy: r.created_by as string,
            isPrivate: (r.is_private as boolean) ?? false,
            createdAt: r.created_at as string,
            updatedAt: r.updated_at as string,
            items: ((r.items as Array<Record<string, unknown>>) ?? [])
              .sort((a, b) => ((a.position as number) ?? 0) - ((b.position as number) ?? 0))
              .map((li) => ({
                id: li.id as string,
                listId: li.list_id as string,
                name: li.name as string,
                quantity: (li.quantity as string) ?? '',
                position: (li.position as number) ?? 0,
              })),
          }));
          set({ savedLists: lists, isLoadingLists: false, listsError: null });
        } catch (err) {
          captureError(err, { context: 'fetch-grocery-lists' });
          set({
            isLoadingLists: false,
            listsError: 'Could not load saved lists. Please try again.',
          });
        }
      },

      createSavedList: async (
        name,
        houseId,
        userId,
        items,
        isPrivate = false,
        displayName = ''
      ): Promise<void> => {
        try {
          const parsed = createSavedListSchema.parse({
            name,
            houseId,
            userId,
            isPrivate,
            displayName,
            items,
          });
          const { data: listData, error: listError } = await supabase.rpc('create_grocery_list', {
            p_house_id: parsed.houseId,
            p_name: parsed.name,
            p_created_by: parsed.userId,
            p_is_private: parsed.isPrivate,
            p_items: parsed.items.map((item, i) => ({
              name: item.name,
              quantity: item.quantity,
              position: i,
            })),
          });
          if (listError) {
            captureError(listError, {
              context: 'create-grocery-list',
              houseId: parsed.houseId,
              userId: parsed.userId,
            });
            throw new Error('Could not save the list. Please try again.');
          }

          const rpcResult = createGroceryListResultSchema.parse(listData);
          const newList: GroceryList = {
            id: rpcResult.id,
            houseId: rpcResult.house_id,
            name: rpcResult.name,
            createdBy: rpcResult.created_by,
            isPrivate: rpcResult.is_private,
            createdAt: rpcResult.created_at,
            updatedAt: rpcResult.updated_at,
            items: parsed.items.map((item, i) => ({
              id: '',
              listId: rpcResult.id,
              name: item.name,
              quantity: item.quantity,
              position: i,
            })),
          };
          set({ savedLists: [newList, ...get().savedLists] });

          if (!parsed.isPrivate) {
            void notifyHousemates({
              houseId: parsed.houseId,
              excludeUserId: parsed.userId,
              title: '📋 New list dropped!',
              body: parsed.displayName
                ? `${parsed.displayName} made a list: "${parsed.name}" 🛍️`
                : `New list ready: "${parsed.name}" — go get the stuff!`,
              data: { screen: 'grocery' },
              notificationType: 'grocery_shared',
            }).catch((err) => captureError(err, { context: 'notify-grocery-list-saved' }));
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.message === 'Could not save the list. Please try again.'
          ) {
            throw err;
          }
          captureError(err, { context: 'createSavedList-unexpected', houseId, userId });
          throw new Error('An unexpected error occurred while saving the list. Please try again.');
        }
      },

      updateSavedList: async (listId, items): Promise<void> => {
        const parsedItems = createSavedListSchema.shape.items.safeParse(items);
        if (!parsedItems.success) {
          captureError(parsedItems.error, { context: 'update-grocery-list-validation' });
          throw new Error('Could not update the list. Please try again.');
        }
        const { error: delError } = await supabase
          .from('grocery_list_items')
          .delete()
          .eq('list_id', listId);
        if (delError) {
          captureError(delError, { context: 'update-grocery-list-delete' });
          throw new Error('Could not update the list. Please try again.');
        }
        if (items.length > 0) {
          const { error: insError } = await supabase.from('grocery_list_items').insert(
            items.map((item, i) => ({
              list_id: listId,
              name: item.name,
              quantity: item.quantity,
              position: i,
            }))
          );
          if (insError) {
            captureError(insError, { context: 'update-grocery-list-insert' });
            throw new Error('Could not update the list. Please try again.');
          }
        }
        const now = new Date().toISOString();
        const { error: updError } = await supabase
          .from('grocery_lists')
          .update({ updated_at: now })
          .eq('id', listId);
        if (updError) {
          captureError(updError, { context: 'update-grocery-list-timestamp' });
          throw new Error('Could not update the list. Please try again.');
        }
        set({
          savedLists: get().savedLists.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  updatedAt: now,
                  items: items.map((item, i) => ({
                    id: '',
                    listId,
                    name: item.name,
                    quantity: item.quantity,
                    position: i,
                  })),
                }
              : l
          ),
        });
      },

      deleteSavedList: async (listId: string): Promise<void> => {
        const { error } = await supabase.from('grocery_lists').delete().eq('id', listId);
        if (error) {
          captureError(error, { context: 'delete-grocery-list' });
          throw new Error('Could not delete the list. Please try again.');
        }
        set({ savedLists: get().savedLists.filter((l) => l.id !== listId) });
      },

      loadListIntoDraft: async (
        list: GroceryList,
        userId: string,
        houseId: string
      ): Promise<void> => {
        const draftExpiresAt = new Date(Date.now() + DRAFT_EXPIRES_MS).toISOString();
        const insertRows = list.items.map((item) => ({
          house_id: houseId,
          name: item.name,
          quantity: item.quantity,
          added_by: userId,
          is_personal: true,
          is_draft: true,
          draft_expires_at: draftExpiresAt,
        }));
        if (insertRows.length > 0) {
          const { error } = await supabase.from('grocery_items').insert(insertRows);
          if (error) {
            captureError(error, { context: 'load-list-into-draft' });
            throw new Error('Could not load the list. Please try again.');
          }
        }
        set({ currentDraftSourceListId: list.id });
        // Reload items so new drafts appear
        await get().load(houseId);
      },

      setCurrentDraftSourceListId: (id: string | null): void => {
        set({ currentDraftSourceListId: id });
      },

      // ── Reminders ────────────────────────────────────────────────────────────

      fetchReminders: async (houseId: string, userId: string): Promise<void> => {
        const parsedHouseId = z.string().uuid().safeParse(houseId);
        const parsedUserId = z.string().uuid().safeParse(userId);
        if (!parsedHouseId.success || !parsedUserId.success) return;
        set({ isLoadingReminders: true });
        try {
          const { data, error } = await supabase
            .from('grocery_reminders')
            .select('*')
            .eq('house_id', houseId)
            .eq('user_id', userId)
            .eq('sent', false)
            .order('remind_at', { ascending: true });
          if (error) throw error;
          const reminders: GroceryReminder[] = (data ?? []).map((r) =>
            mapReminder(r as Record<string, unknown>)
          );
          set({ reminders, isLoadingReminders: false, remindersError: null });
        } catch (err) {
          captureError(err, { context: 'fetch-grocery-reminders', houseId, userId });
          set({
            isLoadingReminders: false,
            remindersError: 'Could not load reminders. Please try again.',
          });
        }
      },

      createReminder: async (params): Promise<void> => {
        try {
          const parsed = createReminderSchema.parse({
            houseId: params.houseId,
            userId: params.userId,
            listId: params.listId ?? null,
            label: params.label,
            remindAt: params.remindAt,
          });
          const { data, error } = await supabase
            .from('grocery_reminders')
            .insert({
              house_id: parsed.houseId,
              user_id: parsed.userId,
              list_id: parsed.listId,
              label: parsed.label,
              remind_at: parsed.remindAt,
            })
            .select()
            .single();
          if (error) throw error;
          const reminder = mapReminder(data as Record<string, unknown>);
          set({
            reminders: [...get().reminders, reminder].sort((a, b) =>
              a.remindAt.localeCompare(b.remindAt)
            ),
          });
        } catch (err) {
          captureError(err, {
            context: 'create-grocery-reminder',
            houseId: params.houseId,
            userId: params.userId,
          });
          throw new Error('Could not set the reminder. Please try again.');
        }
      },

      deleteReminder: async (id: string): Promise<void> => {
        const parsedId = z.string().uuid().safeParse(id);
        if (!parsedId.success) return;
        const prevReminders = get().reminders;
        const target = prevReminders.find((r) => r.id === id);
        set({ reminders: prevReminders.filter((r) => r.id !== id) });
        try {
          const { error } = await supabase.from('grocery_reminders').delete().eq('id', id);
          if (error) throw error;
        } catch (err) {
          // Restore only the deleted reminder, not the whole prior snapshot —
          // a concurrent fetch/create may have changed the list in the meantime.
          const current = get().reminders;
          if (target && !current.some((r) => r.id === target.id)) {
            set({
              reminders: [...current, target].sort((a, b) => a.remindAt.localeCompare(b.remindAt)),
            });
          }
          captureError(err, {
            context: 'delete-grocery-reminder',
            id,
            houseId: target?.houseId ?? '',
            userId: target?.userId ?? '',
          });
          throw new Error('Could not remove the reminder. Please try again.');
        }
      },
    }),
    { name: 'grocery-store' }
  )
);
