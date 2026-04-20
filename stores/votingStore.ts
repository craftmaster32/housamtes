import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';

export interface Vote {
  person: string;
  choice: 'yes' | 'no';
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  isOpen: boolean;
  votes: Vote[];
}

interface VotingStore {
  proposals: Proposal[];
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addProposal: (title: string, description: string, createdBy: string, houseId: string) => Promise<void>;
  castVote: (proposalId: string, person: string, choice: 'yes' | 'no') => Promise<void>;
  closeProposal: (proposalId: string) => Promise<void>;
  remove: (proposalId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useVotingStore = create<VotingStore>()(
  devtools(
    (set, get) => ({
      proposals: [],
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
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
          set({ proposals, isLoading: false });
        } catch {
          set({ isLoading: false });
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
      addProposal: async (title, description, createdBy, houseId): Promise<void> => {
        const { data, error } = await supabase
          .from('proposals')
          .insert({ house_id: houseId, title, description, created_by: createdBy, votes: [] })
          .select()
          .single();
        if (error) throw new Error(`Failed to add proposal: ${error.message}`);
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
      castVote: async (proposalId, person, choice): Promise<void> => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        if (!proposal.isOpen) throw new Error('This vote is already closed');
        const votes: Vote[] = [...proposal.votes.filter((v) => v.person !== person), { person, choice }];
        // Optimistically update UI first
        set({
          proposals: get().proposals.map((p) => (p.id === proposalId ? { ...p, votes } : p)),
        });
        const { error } = await supabase.from('proposals').update({ votes }).eq('id', proposalId);
        if (error) {
          // Revert on failure
          set({
            proposals: get().proposals.map((p) => (p.id === proposalId ? { ...p, votes: proposal.votes } : p)),
          });
          throw new Error(`Failed to cast vote: ${error.message}`);
        }
      },
      closeProposal: async (proposalId): Promise<void> => {
        const { error } = await supabase.from('proposals').update({ is_open: false }).eq('id', proposalId);
        if (error) throw new Error(`Failed to close proposal: ${error.message}`);
        set({
          proposals: get().proposals.map((p) => (p.id === proposalId ? { ...p, isOpen: false } : p)),
        });
      },
      remove: async (proposalId): Promise<void> => {
        const { error } = await supabase.from('proposals').delete().eq('id', proposalId);
        if (error) throw new Error(`Failed to remove proposal: ${error.message}`);
        set({ proposals: get().proposals.filter((p) => p.id !== proposalId) });
      },
    }),
    { name: 'voting-store' }
  )
);
