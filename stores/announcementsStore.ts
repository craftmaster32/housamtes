import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export interface Announcement {
  id: string;
  author: string; // user UUID
  text: string;
  createdAt: string;
}

interface AnnouncementsStore {
  items: Announcement[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  post: (text: string, authorUserId: string, houseId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useAnnouncementsStore = create<AnnouncementsStore>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: true,
      error: null,
      load: async (houseId: string): Promise<void> => {
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
          set({ items, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'announcements', houseId });
          set({ isLoading: false, error: 'Could not load announcements. Please try again.' });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`announcements:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
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
        const item: Announcement = { id: data.id, author: data.author, text: data.text, createdAt: data.created_at };
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
