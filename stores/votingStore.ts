import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import { celebrate } from '@lib/celebrate';

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

type ProposalResult = 'passed' | 'rejected' | 'blocked';

export interface ProposalVoteSummary {
  yesVotes: number;
  noVotes: number;
  totalVoted: number;
  result: ProposalResult;
  votes: Vote[];
}

interface VotingStore {
  proposals: Proposal[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  addProposal: (
    title: string,
    description: string,
    createdByUserId: string,
    houseId: string
  ) => Promise<void>;
  castVote: (proposalId: string, userId: string, choice: 'yes' | 'no') => Promise<void>;
  closeProposal: (proposalId: string) => Promise<void>;
  remove: (proposalId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

// Votes still being saved, by proposal: the choice the person last tapped.
// A reload that lands mid-save (realtime fires on every write) keeps these
// instead of the server's older copy — otherwise ticking Yes then No quickly
// flickers Yes / No / Yes as the reloads catch up.
const _wantedVotes = new Map<string, Vote>();
// What the person's vote was before the unsaved taps, to put back if saving fails.
const _votesBefore = new Map<string, Vote | null>();
// Saves run one after another per proposal, so two taps never race each other.
const _voteQueues = new Map<string, Promise<void>>();

function withVote(proposal: Proposal, vote: Vote | null, person: string): Proposal {
  const others = proposal.votes.filter((v) => v.person !== person);
  return { ...proposal, votes: vote ? [...others, vote] : others };
}

/** The proposals with every unsaved tap laid over the top. */
function withWantedVotes(proposals: Proposal[]): Proposal[] {
  if (_wantedVotes.size === 0) return proposals;
  return proposals.map((p) => {
    const wanted = _wantedVotes.get(p.id);
    return wanted ? withVote(p, wanted, wanted.person) : p;
  });
}

export function summarizeProposalVotes(votes: Vote[]): ProposalVoteSummary {
  const voteByPerson = new Map<string, Vote['choice']>();

  for (const vote of votes) {
    voteByPerson.set(vote.person, vote.choice);
  }

  const currentVotes = Array.from(voteByPerson.entries()).map(([person, choice]) => ({
    person,
    choice,
  }));
  const yesVotes = currentVotes.filter((vote) => vote.choice === 'yes').length;
  const noVotes = currentVotes.filter((vote) => vote.choice === 'no').length;
  const result: ProposalResult =
    yesVotes > noVotes ? 'passed' : noVotes > yesVotes ? 'rejected' : 'blocked';

  return {
    yesVotes,
    noVotes,
    totalVoted: currentVotes.length,
    result,
    votes: currentVotes,
  };
}

export const useVotingStore = create<VotingStore>()(
  devtools(
    (set, get) => ({
      proposals: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[voting] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
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
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ proposals: withWantedVotes(proposals), isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'voting', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load proposals. Please try again.' });
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
          .channel(`voting:${houseId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'proposals', filter: `house_id=eq.${houseId}` },
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
        const wanted: Vote = { person: userId, choice };
        if (!_wantedVotes.has(proposalId)) {
          _votesBefore.set(proposalId, proposal.votes.find((v) => v.person === userId) ?? null);
        }
        _wantedVotes.set(proposalId, wanted);
        set({ proposals: withWantedVotes(get().proposals) });

        // Saves whatever was tapped last; a tap that a later save already
        // covered has nothing left to do.
        const save = async (): Promise<void> => {
          const latest = _wantedVotes.get(proposalId);
          const current = get().proposals.find((p) => p.id === proposalId);
          if (!latest || !current) return;
          const { error } = await supabase
            .from('proposals')
            .update({ votes: current.votes })
            .eq('id', proposalId);
          if (error) throw error;
          if (_wantedVotes.get(proposalId) === latest) {
            _wantedVotes.delete(proposalId);
            _votesBefore.delete(proposalId);
          }
        };
        const run = (_voteQueues.get(proposalId) ?? Promise.resolve())
          .catch(() => undefined)
          .then(save);
        _voteQueues.set(proposalId, run);
        try {
          await run;
        } catch (err) {
          // Put the person's vote back as it was before these taps — unless
          // they've tapped again since, and that newer save gets its own go.
          if (_wantedVotes.get(proposalId) === wanted) {
            const before = _votesBefore.get(proposalId) ?? null;
            _wantedVotes.delete(proposalId);
            _votesBefore.delete(proposalId);
            set({
              proposals: get().proposals.map((p) =>
                p.id === proposalId ? withVote(p, before, userId) : p
              ),
            });
          }
          captureError(err, { context: 'cast-vote', proposalId });
          throw new Error('Could not record your vote. Please try again.');
        } finally {
          if (_voteQueues.get(proposalId) === run) _voteQueues.delete(proposalId);
        }
      },
      closeProposal: async (proposalId): Promise<void> => {
        try {
          const { error } = await supabase
            .from('proposals')
            .update({ is_open: false })
            .eq('id', proposalId);
          if (error) throw error;
        } catch (err) {
          captureError(err, { context: 'close-proposal', proposalId });
          throw new Error('Could not close the proposal. Please try again.');
        }
        set({
          proposals: get().proposals.map((p) =>
            p.id === proposalId ? { ...p, isOpen: false } : p
          ),
        });
        const closed = get().proposals.find((p) => p.id === proposalId);
        if (closed && summarizeProposalVotes(closed.votes).result === 'passed') celebrate('vote');
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
