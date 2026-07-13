import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import { houseNoteSchema } from '@utils/validation';

// The house notice board (FEATURES.md 4.5) is built on the `announcements`
// table: a note is an announcement row with is_pinned = true. The board keeps
// at most MAX_NOTES notes — pinning a new one past the cap auto-archives the
// oldest (is_pinned flips to false), so nothing is ever hard-deleted by the cap.
export const MAX_NOTES = 20;

export interface Announcement {
  id: string;
  author: string; // user UUID
  text: string;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementsStore {
  items: Announcement[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  post: (text: string, authorUserId: string, houseId: string) => Promise<void>;
  edit: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function rowToNote(r: Record<string, unknown>): Announcement {
  return {
    id: r.id as string,
    author: r.author as string,
    text: r.text as string,
    createdAt: r.created_at as string,
    updatedAt: (r.updated_at ?? r.created_at) as string,
  };
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

export const useAnnouncementsStore = create<AnnouncementsStore>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[announcements] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('house_id', houseId)
            .eq('is_pinned', true)
            .order('created_at', { ascending: false })
            .limit(MAX_NOTES);
          if (error) throw error;
          const items: Announcement[] = (data ?? []).map(rowToNote);
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ items, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'announcements', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load the notice board. Please try again.' });
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
          .channel(`announcements:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'announcements',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
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
      post: async (text, authorUserId, houseId): Promise<void> => {
        const parsed = houseNoteSchema.parse({ text });
        const { data, error } = await supabase
          .from('announcements')
          .insert({ house_id: houseId, author: authorUserId, text: parsed.text, is_pinned: true })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'post-note', houseId, userId: authorUserId });
          throw new Error('Could not pin the note. Please try again.');
        }
        const next = [rowToNote(data as Record<string, unknown>), ...get().items];
        set({ items: next.slice(0, MAX_NOTES) });
        // Enforce the cap against the database, not the local cache — a stale
        // cache (or two people posting at once) must never unpin the wrong
        // notes or leave more than MAX_NOTES pinned. Best-effort: if this
        // fails the extra notes simply stay pinned until the next post.
        const { data: pinnedRows, error: pinnedError } = await supabase
          .from('announcements')
          .select('id')
          .eq('house_id', houseId)
          .eq('is_pinned', true)
          .order('created_at', { ascending: false });
        if (pinnedError) {
          captureError(pinnedError, {
            context: 'archive-notes-query',
            houseId,
            userId: authorUserId,
          });
          return;
        }
        const overflowIds = ((pinnedRows ?? []) as Array<{ id: string }>)
          .slice(MAX_NOTES)
          .map((r) => r.id);
        if (overflowIds.length > 0) {
          const { error: archiveError } = await supabase
            .from('announcements')
            .update({ is_pinned: false })
            .in('id', overflowIds);
          if (archiveError) {
            captureError(archiveError, { context: 'archive-notes', houseId, userId: authorUserId });
          }
        }
      },
      edit: async (id, text): Promise<void> => {
        const parsed = houseNoteSchema.parse({ text });
        const { error } = await supabase
          .from('announcements')
          .update({ text: parsed.text })
          .eq('id', id);
        if (error) {
          captureError(error, {
            context: 'edit-note',
            announcementId: id,
            houseId: useAuthStore.getState().houseId ?? '',
          });
          throw new Error('Could not save the note. Please try again.');
        }
        const now = new Date().toISOString();
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, text: parsed.text, updatedAt: now } : i
          ),
        });
      },
      remove: async (id): Promise<void> => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) {
          captureError(error, {
            context: 'delete-note',
            announcementId: id,
            houseId: useAuthStore.getState().houseId ?? '',
          });
          throw new Error('Could not delete the note. Please try again.');
        }
        set({ items: get().items.filter((i) => i.id !== id) });
      },
    }),
    { name: 'announcements-store' }
  )
);
