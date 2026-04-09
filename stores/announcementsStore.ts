import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

export interface Announcement {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface AnnouncementsStore {
  items: Announcement[];
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  post: (text: string, author: string, houseId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useAnnouncementsStore = create<AnnouncementsStore>()(
  devtools(
    (set, get) => ({
      items: [],
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
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
          set({ items, isLoading: false });
        } catch {
          set({ isLoading: false });
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
      post: async (text, author, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('announcements')
          .insert({ house_id: houseId, author, text: text.trim() })
          .select()
          .single();
        if (error) throw new Error(`Failed to post announcement: ${error.message}`);
        const item: Announcement = { id: data.id, author: data.author, text: data.text, createdAt: data.created_at };
        set({ items: [item, ...get().items].slice(0, 30) });
      },
      remove: async (id): Promise<void> => {
        await supabase.from('announcements').delete().eq('id', id);
        set({ items: get().items.filter((i) => i.id !== id) });
      },
    }),
    { name: 'announcements-store' }
  )
);
