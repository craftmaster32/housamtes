import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

interface Announcement {
  id: string;
  author: string; // user UUID
  text: string;
  createdAt: string;
}

interface AnnouncementsStore {
  items: Announcement[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  post: (text: string, authorUserId: string, houseId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
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
        const seq = ++_loadSeq;
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[announcements] house ID mismatch — aborting load');
          return;
        }
        try {
          const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false })
            .limit(30);
          if (error) throw error;
          const items: Announcement[] = (data ?? []).map((r) => ({
            id: r.id,
            author: r.author,
            text: r.text,
            createdAt: r.created_at,
          }));
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ items, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'announcements', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load announcements. Please try again.' });
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
        const { data, error } = await supabase
          .from('announcements')
          .insert({ house_id: houseId, author: authorUserId, text: text.trim() })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'post-announcement', houseId });
          throw new Error('Could not post the announcement. Please try again.');
        }
        const item: Announcement = {
          id: data.id,
          author: data.author,
          text: data.text,
          createdAt: data.created_at,
        };
        set({ items: [item, ...get().items].slice(0, 30) });
      },
      remove: async (id): Promise<void> => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) {
          captureError(error, { context: 'delete-announcement', announcementId: id });
          throw new Error('Could not delete the announcement. Please try again.');
        }
        set({ items: get().items.filter((i) => i.id !== id) });
      },
    }),
    { name: 'announcements-store' }
  )
);
