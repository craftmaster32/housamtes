import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  unreadCount: number;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  markRead: () => void;
  send: (text: string, author: string, houseId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

function mapRow(r: Record<string, unknown>): ChatMessage {
  return {
    id: r.id as string,
    author: r.sender as string,
    text: r.text as string,
    createdAt: r.created_at as string,
  };
}

export const useChatStore = create<ChatStore>()(
  devtools(
    (set, get) => ({
      messages: [],
      isLoading: true,
      unreadCount: 0,
      load: async (houseId: string): Promise<void> => {
        try {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: true })
            .limit(200);
          if (error) throw error;
          set({ messages: (data ?? []).map(mapRow), isLoading: false });
        } catch {
          set({ isLoading: false });
        }

        // Real-time: append new messages directly (no re-fetch to keep chat snappy)
        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`chat:${houseId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `house_id=eq.${houseId}` },
            (payload) => {
              const msg = mapRow(payload.new as Record<string, unknown>);
              // Avoid duplicates (our own sends are already in local state)
              if (get().messages.some((m) => m.id === msg.id)) return;
              set({
                messages: [...get().messages, msg].slice(-200),
                unreadCount: get().unreadCount + 1,
              });
            })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages', filter: `house_id=eq.${houseId}` },
            (payload) => {
              const id = (payload.old as Record<string, unknown>).id as string;
              set({ messages: get().messages.filter((m) => m.id !== id) });
            })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      markRead: (): void => {
        set({ unreadCount: 0 });
      },
      send: async (text, author, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({ house_id: houseId, sender: author, text: text.trim() })
          .select()
          .single();
        if (error) throw new Error(`Failed to send message: ${error.message}`);
        const msg = mapRow(data as Record<string, unknown>);
        set({ messages: [...get().messages, msg].slice(-200) });
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? '';
        if (userId) {
          notifyHousemates({
            houseId,
            excludeUserId: userId,
            title: author,
            body: text.trim().slice(0, 100),
            data: { screen: 'chat' },
            notificationType: 'chat_message',
          });
        }
      },
      remove: async (id): Promise<void> => {
        await supabase.from('chat_messages').delete().eq('id', id);
        set({ messages: get().messages.filter((m) => m.id !== id) });
      },
    }),
    { name: 'chat-store' }
  )
);
