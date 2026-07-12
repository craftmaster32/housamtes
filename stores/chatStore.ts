import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export interface ChatMessage {
  id: string;
  author: string; // user UUID
  text: string;
  createdAt: string;
}

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  unreadCount: number;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  markRead: () => void;
  send: (
    text: string,
    senderUserId: string,
    senderDisplayName: string,
    houseId: string
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

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
      error: null,
      clearError: (): void => set({ error: null }),
      unreadCount: 0,
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[chat] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: true })
            .limit(200);
          if (error) throw error;
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ messages: (data ?? []).map(mapRow), isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'chat', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load messages. Please try again.' });
        }

        // Real-time: append new messages directly (no re-fetch to keep chat snappy)
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
          .channel(`chat:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `house_id=eq.${houseId}`,
            },
            (payload) => {
              const msg = mapRow(payload.new as Record<string, unknown>);
              if (get().messages.some((m) => m.id === msg.id)) return;
              set({
                messages: [...get().messages, msg].slice(-200),
                unreadCount: get().unreadCount + 1,
              });
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'chat_messages',
              filter: `house_id=eq.${houseId}`,
            },
            (payload) => {
              const id = (payload.old as Record<string, unknown>).id as string;
              set({ messages: get().messages.filter((m) => m.id !== id) });
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
      markRead: (): void => {
        set({ unreadCount: 0 });
      },
      send: async (text, senderUserId, senderDisplayName, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert({ house_id: houseId, sender: senderUserId, text: text.trim() })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'send-chat', houseId });
          throw new Error('Could not send the message. Please try again.');
        }
        const msg = mapRow(data as Record<string, unknown>);
        set({ messages: [...get().messages, msg].slice(-200) });
        notifyHousemates({
          houseId,
          excludeUserId: senderUserId,
          title: senderDisplayName,
          body: text.trim().slice(0, 100),
          data: { screen: 'chat' },
          notificationType: 'chat_message',
        });
      },
      remove: async (id): Promise<void> => {
        const { error } = await supabase.from('chat_messages').delete().eq('id', id);
        if (error) {
          captureError(error, { context: 'delete-chat', messageId: id });
          throw new Error('Could not delete the message. Please try again.');
        }
        set({ messages: get().messages.filter((m) => m.id !== id) });
      },
    }),
    { name: 'chat-store' }
  )
);
