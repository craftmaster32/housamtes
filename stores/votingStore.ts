import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export interface Vote {
  person: string; // user UUID
  choice: 'yes' | 'no';
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  createdBy: string; // user UUID
  createdAt: string;
  isOpen: boolean;
  votes: Vote[];
}

interface VotingStore {
  proposals: Proposal[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addProposal: (title: string, description: string, createdByUserId: string, houseId: string) => Promise<void>;
  castVote: (proposalId: string, userId: string, choice: 'yes' | 'no') => Promise<void>;
  closeProposal: (proposalId: string) => Promise<void>;
  remove: (proposalId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useVotingStore = create<VotingStore>()(
  devtools(
    (set, get) => ({
      proposals: [],
      isLoading: true,
      error: null,
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[voting] house ID mismatch — aborting load');
          return;
        }
        try {
          const { data, error } = await supabase
            .from('proposals')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const proposals: Proposal[] = (data ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description ?? '',
            createdBy: r.created_by,
            createdAt: r.created_at,
            isOpen: r.is_open,
            votes: (r.votes ?? []) as Vote[],
          }));
          set({ proposals, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'voting', houseId });
          set({ isLoading: false, error: 'Could not load proposals. Please try again.' });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`voting:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'proposals', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      addProposal: async (title, description, createdByUserId, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('proposals')
          .insert({ house_id: houseId, title, description, created_by: createdByUserId, votes: [] })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'add-proposal', houseId });
          throw new Error('Could not save the proposal. Please try again.');
        }
        const proposal: Proposal = {
          id: data.id,
          title: data.title,
          description: data.description ?? '',
          createdBy: data.created_by,
          createdAt: data.created_at,
          isOpen: true,
          votes: [],
        };
        set({ proposals: [proposal, ...get().proposals] });
      },
      castVote: async (proposalId, userId, choice): Promise<void> => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        if (!proposal.isOpen) throw new Error('This vote is already closed');
        const votes: Vote[] = [...proposal.votes.filter((v) => v.person !== userId), { person: userId, choice }];
        set({ proposals: get().proposals.map((p) => (p.id === proposalId ? { ...p, votes } : p)) });
        const { error } = await supabase.from('proposals').update({ votes }).eq('id', proposalId);
        if (error) {
          set({ proposals: get().proposals.map((p) => (p.id === proposalId ? { ...p, votes: proposal.votes } : p)) });
          captureError(error, { context: 'cast-vote', proposalId });
          throw new Error('Could not record your vote. Please try again.');
        }
      },
      closeProposal: async (proposalId): Promise<void> => {
        const { error } = await supabase.from('proposals').update({ is_open: false }).eq('id', proposalId);
        if (error) {
          captureError(error, { context: 'close-proposal', proposalId });
          throw new Error('Could not close the proposal. Please try again.');
        }
        set({ proposals: get().proposals.map((p) => (p.id === proposalId ? { ...p, isOpen: false } : p)) });
      },
      remove: async (proposalId): Promise<void> => {
        const { error } = await supabase.from('proposals').delete().eq('id', proposalId);
        if (error) {
          captureError(error, { context: 'delete-proposal', proposalId });
          throw new Error('Could not delete the proposal. Please try again.');
        }
        set({ proposals: get().proposals.filter((p) => p.id !== proposalId) });
      },
    }),
    { name: 'voting-store' }
  )
);
