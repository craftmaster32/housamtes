import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

export type ParkingVoteChoice = 'approve' | 'reject';
export type ParkingReservationStatus = 'pending' | 'approved' | 'rejected';

export interface ParkingSession {
  id: string;
  occupant: string; // user UUID
  startTime: string;
}

export interface ParkingVote {
  userId: string;
  vote: ParkingVoteChoice;
}

export interface ParkingVoteTally {
  approveCount: number;
  rejectCount: number;
  votedCount: number;
  eligibleVoterCount: number;
  hasEveryoneVoted: boolean;
  status: ParkingReservationStatus;
}

export interface ParkingReservation {
  id: string;
  requestedBy: string; // user UUID
  date: string;
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  note: string;
  status: ParkingReservationStatus;
  createdAt: string;
  votes: ParkingVote[];
}

interface ParkingStore {
  current: ParkingSession | null;
  reservations: ParkingReservation[];
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  claim: (userId: string, displayName: string, houseId: string) => Promise<void>;
  release: (houseId: string, displayName?: string) => Promise<void>;
  addReservation: (
    r: Omit<ParkingReservation, 'id' | 'createdAt' | 'status' | 'votes'>,
    displayName: string,
    houseId: string
  ) => Promise<string>;
  cancelReservation: (id: string, houseId: string) => Promise<void>;
  voteOnReservation: (
    reservationId: string,
    vote: ParkingVoteChoice,
    houseId: string
  ) => Promise<ParkingReservationStatus>;
  clearHistoryItem: (id: string) => Promise<void>;
  clearAllHistory: (houseId: string) => Promise<void>;
  checkReservationAutoApply: (houseId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export function tallyParkingReservationVotes(
  votes: ParkingVote[],
  eligibleVoterIds: string[]
): ParkingVoteTally {
  const eligibleVoters = new Set(eligibleVoterIds);
  const voteByUser = new Map<string, ParkingVoteChoice>();

  for (const vote of votes) {
    if (eligibleVoters.has(vote.userId)) {
      voteByUser.set(vote.userId, vote.vote);
    }
  }

  const currentVotes = Array.from(voteByUser.values());
  const approveCount = currentVotes.filter((vote) => vote === 'approve').length;
  const rejectCount = currentVotes.filter((vote) => vote === 'reject').length;
  const votedCount = voteByUser.size;
  const remaining = eligibleVoterIds.length - votedCount;
  const hasEveryoneVoted =
    eligibleVoterIds.length > 0 && eligibleVoterIds.every((id) => voteByUser.has(id));

  let status: ParkingReservationStatus = 'pending';
  // Resolve early when the leader can no longer be overtaken by remaining votes
  if (approveCount > rejectCount + remaining) {
    status = 'approved';
  } else if (rejectCount > approveCount + remaining) {
    status = 'rejected';
  } else if (hasEveryoneVoted && approveCount > rejectCount) {
    status = 'approved';
  } else if (hasEveryoneVoted && rejectCount > approveCount) {
    status = 'rejected';
  }

  return {
    approveCount,
    rejectCount,
    votedCount,
    eligibleVoterCount: eligibleVoterIds.length,
    hasEveryoneVoted,
    status,
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

export interface ConflictResult {
  conflict: string | null;
  warning: string | null;
}

export function isDateConflict(
  date: string,
  startTime: string | undefined,
  endTime: string | undefined,
  reservations: ParkingReservation[],
  resolveName?: (id: string) => string
): ConflictResult {
  const sameDay = reservations.filter(
    (r) => r.date === date && (r.status === 'approved' || r.status === 'pending')
  );
  if (sameDay.length === 0) return { conflict: null, warning: null };

  let smallestGap = Infinity;
  let gapWarning: string | null = null;

  for (const r of sameDay) {
    const name = resolveName ? resolveName(r.requestedBy) : r.requestedBy;
    const label = r.status === 'approved' ? 'reserved' : 'pending';

    if (!startTime && !endTime && !r.startTime && !r.endTime) {
      // Both sides all-day → hard conflict
      return { conflict: `${name} already has the spot ${label} on this day`, warning: null };
    }

    if (startTime && endTime && r.startTime && r.endTime) {
      // Both fully timed → overlap / gap logic
      const newStart = toMinutes(startTime);
      const newEnd = toMinutes(endTime);
      const exStart = toMinutes(r.startTime);
      const exEnd = toMinutes(r.endTime);

      if (newStart < exEnd && newEnd > exStart) {
        return {
          conflict: `Overlaps with ${name}'s ${label} slot (${r.startTime}–${r.endTime})`,
          warning: null,
        };
      }

      const gap = newStart >= exEnd ? newStart - exEnd : exStart - newEnd;
      if (gap < smallestGap) {
        smallestGap = gap;
        if (gap <= 15) {
          gapWarning = `Only ${gap} min between your slot and ${name}'s — very tight, coordinate timing.`;
        } else if (gap <= 60) {
          gapWarning = `${name} has the spot ${gap} min before/after yours — times are close.`;
        }
      }
    } else {
      // Exactly one of startTime/endTime is set — user is mid-entry; don't block.
      if (Boolean(startTime) !== Boolean(endTime)) {
        return { conflict: null, warning: null };
      }
      // All-day candidate vs timed existing, or timed candidate vs all-day existing → hard conflict.
      return {
        conflict: `${name} has the spot ${label} on this day — exact times may overlap.`,
        warning: null,
      };
    }
  }

  return { conflict: null, warning: gapWarning };
}

export const useParkingStore = create<ParkingStore>()(
  devtools(
    (set, get) => ({
      current: null,
      reservations: [],
      isLoading: true,
      error: null,
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[parking] house ID mismatch — aborting load');
          return;
        }
        try {
          const [sessionRes, reservRes] = await Promise.all([
            supabase
              .from('parking_sessions')
              .select('*')
              .eq('house_id', houseId)
              .eq('is_active', true)
              .order('start_time', { ascending: false })
              .limit(1),
            supabase
              .from('parking_reservations')
              .select('*, parking_reservation_votes(user_id, vote)')
              .eq('house_id', houseId)
              .order('date'),
          ]);
          if (sessionRes.error) throw sessionRes.error;
          if (reservRes.error) throw reservRes.error;

          const sessionRow = (sessionRes.data ?? [])[0] ?? null;
          const current: ParkingSession | null = sessionRow
            ? { id: sessionRow.id, occupant: sessionRow.occupant, startTime: sessionRow.start_time }
            : null;
          const reservations: ParkingReservation[] = (reservRes.data ?? []).map((r) => ({
            id: r.id,
            requestedBy: r.requested_by,
            date: r.date,
            startTime: r.start_time ?? undefined,
            endTime: r.end_time ?? undefined,
            note: r.note ?? '',
            status: r.status as ParkingReservationStatus,
            createdAt: r.created_at,
            votes: ((r.parking_reservation_votes ?? []) as { user_id: string; vote: string }[]).map(
              (v) => ({ userId: v.user_id, vote: v.vote as ParkingVoteChoice })
            ),
          }));
          set({ current, reservations, isLoading: false, error: null });
          await get().checkReservationAutoApply(houseId);
        } catch (err) {
          captureError(err, { store: 'parking', houseId });
          set({ isLoading: false, error: 'Could not load parking data. Please try again.' });
        }

        if (_channel) {
          supabase.removeChannel(_channel);
        }
        _channel = supabase
          .channel(`parking:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'parking_sessions',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'parking_reservations',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'parking_reservation_votes',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
        }
      },
      claim: async (userId, displayName, houseId): Promise<void> => {
        if (!userId) throw new Error('User ID is required to claim parking');

        // Abort if initial load is still in flight — local state may be stale
        if (get().isLoading) throw new Error('Still loading parking data, please try again');

        // Use already-loaded realtime state instead of a separate round-trip SELECT
        if (get().current) throw new Error('Parking spot is already taken');

        // Block if another housemate has an approved reservation covering right now
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        const conflictingReservation = get().reservations.find((r) => {
          if (r.status !== 'approved' || r.date !== todayStr || r.requestedBy === userId)
            return false;
          const start = r.startTime
            ? parseInt(r.startTime.split(':')[0], 10) * 60 + parseInt(r.startTime.split(':')[1], 10)
            : 0;
          const end = r.endTime
            ? parseInt(r.endTime.split(':')[0], 10) * 60 + parseInt(r.endTime.split(':')[1], 10)
            : 24 * 60;
          return nowMinutes >= start && nowMinutes < end;
        });
        if (conflictingReservation) {
          throw new Error('The spot is reserved by a housemate right now');
        }

        // Optimistic update — feels instant, reverts on failure
        const optimistic: ParkingSession = {
          id: 'optimistic',
          occupant: userId,
          startTime: now.toISOString(),
        };
        set({ current: optimistic });

        try {
          const { data, error } = await supabase
            .from('parking_sessions')
            .insert({ house_id: houseId, occupant: userId, is_active: true })
            .select()
            .single();
          if (error) {
            set({ current: null });
            captureError(error, { context: 'claim-parking', houseId });
            throw new Error('Could not claim the parking spot. Please try again.');
          }
          set({ current: { id: data.id, occupant: data.occupant, startTime: data.start_time } });
          notifyHousemates({
            houseId,
            excludeUserId: userId,
            title: '🚗 Spot taken!',
            body: `${displayName} nabbed the parking spot. First come, first parked 🏎️`,
            data: { screen: 'parking' },
            notificationType: 'parking_claimed',
          });
        } catch (err) {
          set({ current: null });
          throw err;
        }
      },
      release: async (houseId: string, displayName?: string): Promise<void> => {
        const previous = get().current;
        if (!previous) return;

        // Claim is still in flight — the DB row doesn't exist yet, so the UPDATE would be a no-op
        if (previous.id === 'optimistic')
          throw new Error('Claim is still in progress, please wait a moment');

        try {
          // Optimistic update — feels instant, reverts on failure
          set({ current: null });

          const { data: updated, error } = await supabase
            .from('parking_sessions')
            .update({ is_active: false })
            .eq('id', previous.id)
            .eq('house_id', houseId)
            .select();
          if (error) throw error;
          if (!updated?.length)
            throw new Error('No rows updated: parking session not found or already inactive');

          // Notification fires in background — doesn't block the UI
          let notifyUserId = '';
          supabase.auth
            .getSession()
            .then(({ data: sessionData }) => {
              notifyUserId = sessionData.session?.user.id ?? '';
              if (notifyUserId) {
                return notifyHousemates({
                  houseId,
                  excludeUserId: notifyUserId,
                  title: "🅿️ Spot's free — go go go!",
                  body: displayName
                    ? `${displayName} freed the spot. Quick, claim it! 🏃`
                    : 'The spot is free — first come, first parked!',
                  data: { screen: 'parking' },
                  notificationType: 'parking_claimed',
                });
              }
            })
            .catch((err) =>
              captureError(err, { context: 'notify-release', houseId, userId: notifyUserId })
            );
        } catch (err) {
          set({ current: previous });
          captureError(err, { context: 'release-parking', houseId });
          throw new Error('Could not release the parking spot. Please try again.');
        }
      },
      addReservation: async (data, displayName, houseId): Promise<string> => {
        if (!houseId || !data.requestedBy) {
          throw new Error('Please wait while your profile loads before reserving a parking spot.');
        }
        const { data: inserted, error } = await supabase
          .from('parking_reservations')
          .insert({
            house_id: houseId,
            requested_by: data.requestedBy,
            date: data.date,
            start_time: data.startTime ?? null,
            end_time: data.endTime ?? null,
            note: data.note,
          })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'add-reservation', houseId });
          throw new Error('Could not save the reservation. Please try again.');
        }
        const r: ParkingReservation = {
          id: inserted.id,
          requestedBy: inserted.requested_by,
          date: inserted.date,
          startTime: inserted.start_time ?? undefined,
          endTime: inserted.end_time ?? undefined,
          note: inserted.note ?? '',
          status: 'pending',
          createdAt: inserted.created_at,
          votes: [],
        };
        const alreadyPresent = get().reservations.some((res) => res.id === r.id);
        if (alreadyPresent) {
          set({ reservations: get().reservations.map((res) => (res.id === r.id ? r : res)) });
        } else {
          set({ reservations: [r, ...get().reservations] });
        }
        const timeStr = data.startTime
          ? ` at ${data.startTime}${data.endTime ? `–${data.endTime}` : ''}`
          : '';
        void notifyHousemates({
          houseId,
          excludeUserId: data.requestedBy,
          title: '🙏 Calling dibs!',
          body: `${displayName} wants the spot on ${data.date}${timeStr}${data.note ? ` — "${data.note}"` : ''}. Vote!`,
          data: { screen: 'parking' },
          notificationType: 'parking_reservation',
        }).catch((notifyErr) => captureError(notifyErr, { context: 'notify-housemates', houseId }));
        return r.id;
      },
      cancelReservation: async (id, houseId): Promise<void> => {
        const userId = useAuthStore.getState().profile?.id ?? '';
        try {
          const reservation = get().reservations.find((r) => r.id === id);
          const { error } = await supabase.from('parking_reservations').delete().eq('id', id);
          if (error) {
            captureError(error, { context: 'cancel-reservation', houseId, userId });
            throw new Error('Could not cancel the reservation. Please try again.');
          }
          set({ reservations: get().reservations.filter((r) => r.id !== id) });
          const current = get().current;
          if (reservation && current && current.occupant === reservation.requestedBy) {
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            if (reservation.date === todayStr) {
              await get().release(houseId);
            }
          }
        } catch (err) {
          if (err instanceof Error) throw err;
          captureError(err, { context: 'cancel-reservation', houseId, userId });
          throw new Error('Could not cancel the reservation. Please try again.');
        }
      },
      voteOnReservation: async (
        reservationId,
        vote,
        houseId
      ): Promise<ParkingReservationStatus> => {
        let userId = '';
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          userId = sessionData.session?.user.id ?? '';
          if (!userId) throw new Error('Not signed in');

          // Guard: only allow voting on pending reservations; requester cannot vote on their own request
          const localReservation = get().reservations.find((r) => r.id === reservationId);
          if (!localReservation) throw new Error('Reservation not found');
          if (localReservation.status !== 'pending')
            throw new Error('This request is no longer pending');
          if (userId === localReservation.requestedBy)
            throw new Error('You cannot vote on your own request');

          const { error: voteError } = await supabase
            .from('parking_reservation_votes')
            .upsert(
              { reservation_id: reservationId, house_id: houseId, user_id: userId, vote },
              { onConflict: 'reservation_id,user_id' }
            );
          if (voteError) {
            captureError(voteError, { context: 'vote-reservation', reservationId });
            throw new Error('Could not save your vote. Please try again.');
          }

          const { data: allVotes, error: selectError } = await supabase
            .from('parking_reservation_votes')
            .select('user_id, vote')
            .eq('reservation_id', reservationId);
          if (selectError) {
            captureError(selectError, { context: 'vote-tally', reservationId });
            throw new Error('Could not read vote tally. Please try again.');
          }

          // Fetch authoritative member list from DB — don't trust caller-supplied IDs
          const { data: memberRows, error: membersError } = await supabase
            .from('house_members')
            .select('user_id')
            .eq('house_id', houseId);
          if (membersError) {
            captureError(membersError, { context: 'vote-members', houseId });
            throw new Error('Could not read house members. Please try again.');
          }

          const voterIds = ((memberRows ?? []) as { user_id: string }[])
            .map((m) => m.user_id)
            .filter((id) => id !== localReservation.requestedBy);
          const votes = ((allVotes ?? []) as { user_id: string; vote: ParkingVoteChoice }[]).map(
            (row) => ({ userId: row.user_id, vote: row.vote })
          );
          const newStatus = tallyParkingReservationVotes(votes, voterIds).status;

          let statusWasUpdated = false;
          if (newStatus !== 'pending') {
            const { data: updated, error: updateError } = await supabase
              .from('parking_reservations')
              .update({ status: newStatus })
              .eq('id', reservationId)
              .eq('status', 'pending') // guard against concurrent finalisation
              .select();
            if (updateError) {
              captureError(updateError, { context: 'vote-status-update', reservationId });
              throw new Error('Could not update reservation status. Please try again.');
            }
            statusWasUpdated = (updated?.length ?? 0) > 0;

            if (statusWasUpdated && newStatus === 'approved') {
              notifyHousemates({
                houseId,
                excludeUserId: userId,
                title: '✅ You got the spot!',
                body: `Parking confirmed for ${localReservation.date}${localReservation.startTime ? ` at ${localReservation.startTime}` : ''}. You're welcome 🤝`,
                data: { screen: 'parking' },
                notificationType: 'parking_reservation',
              });
            }
          } else {
            // Vote cast but still pending — remind whoever hasn't voted yet
            const votedUserIds = new Set(votes.map((v) => v.userId));
            const nonVoterIds = voterIds.filter((id) => !votedUserIds.has(id));
            if (nonVoterIds.length > 0) {
              notifyHousemates({
                houseId,
                excludeUserId: userId,
                includeUserIds: nonVoterIds,
                title: '🗳️ Your vote is needed!',
                body: `The parking vote for ${localReservation.date} is still open — cast your vote before it expires.`,
                data: { screen: 'parking' },
                notificationType: 'parking_reservation',
              }).catch((err) =>
                captureError(err, { context: 'notify-non-voters', houseId, userId })
              );
            }
          }

          // Optimistic local update while realtime syncs
          set({
            reservations: get().reservations.map((r) => {
              if (r.id !== reservationId) return r;
              const existing = r.votes.findIndex((v) => v.userId === userId);
              const updatedVotes =
                existing >= 0
                  ? r.votes.map((v, i) => (i === existing ? { userId, vote } : v))
                  : [...r.votes, { userId, vote }];
              return { ...r, votes: updatedVotes, status: statusWasUpdated ? newStatus : r.status };
            }),
          });

          return statusWasUpdated ? newStatus : 'pending';
        } catch (err) {
          if (err instanceof Error) throw err;
          captureError(err, { context: 'vote-reservation', reservationId, houseId, userId });
          throw new Error('Could not save your vote. Please try again.');
        }
      },
      clearHistoryItem: async (id): Promise<void> => {
        const userId = useAuthStore.getState().profile?.id ?? '';
        try {
          const reservation = get().reservations.find((r) => r.id === id);
          if (!reservation) throw new Error('Reservation not found');
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          if (reservation.date >= todayStr)
            throw new Error('Cannot clear a future or current reservation');

          const { error } = await supabase.from('parking_reservations').delete().eq('id', id);
          if (error) {
            captureError(error, { context: 'clear-history-item', id, userId });
            throw new Error('Could not clear this item. Please try again.');
          }
          set({ reservations: get().reservations.filter((r) => r.id !== id) });
        } catch (err) {
          if (err instanceof Error) throw err;
          captureError(err, { context: 'clear-history-item', id, userId });
          throw new Error('Could not clear this item. Please try again.');
        }
      },
      clearAllHistory: async (houseId: string): Promise<void> => {
        const userId = useAuthStore.getState().profile?.id ?? '';
        try {
          const { reservations } = get();
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const historyIds = reservations.filter((r) => r.date < todayStr).map((r) => r.id);
          if (historyIds.length === 0) return;
          const { error } = await supabase
            .from('parking_reservations')
            .delete()
            .eq('house_id', houseId)
            .in('id', historyIds);
          if (error) throw error;
          set({ reservations: get().reservations.filter((r) => r.date >= todayStr) });
        } catch (err) {
          captureError(err, { context: 'clear-all-history', houseId, userId });
          throw new Error('Could not clear history. Please try again.');
        }
      },
      checkReservationAutoApply: async (houseId: string): Promise<void> => {
        const { current, reservations } = get();
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const nowMinutes = now.getHours() * 60 + now.getMinutes();

        const dueReservation = reservations.find((r) => {
          if (r.status !== 'approved' || r.date !== todayStr) return false;
          const startMinutes = r.startTime
            ? parseInt(r.startTime.split(':')[0], 10) * 60 + parseInt(r.startTime.split(':')[1], 10)
            : 0;
          const endMinutes = r.endTime
            ? parseInt(r.endTime.split(':')[0], 10) * 60 + parseInt(r.endTime.split(':')[1], 10)
            : 24 * 60;
          return nowMinutes >= startMinutes && nowMinutes < endMinutes;
        });

        if (dueReservation && !current) {
          const { data: activeCheck } = await supabase
            .from('parking_sessions')
            .select('id')
            .eq('house_id', houseId)
            .eq('is_active', true)
            .maybeSingle();
          if (activeCheck) return;

          const { data, error } = await supabase
            .from('parking_sessions')
            .insert({ house_id: houseId, occupant: dueReservation.requestedBy, is_active: true })
            .select()
            .single();
          if (!error && data) {
            set({ current: { id: data.id, occupant: data.occupant, startTime: data.start_time } });
          }
        }
      },
    }),
    { name: 'parking-store' }
  )
);
