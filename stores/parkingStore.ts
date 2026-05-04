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

export interface ParkingReservation {
  id: string;
  requestedBy: string; // user UUID
  date: string;
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
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
  release: (houseId: string) => Promise<void>;
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
  checkReservationAutoApply: (houseId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export function isDateConflict(
  date: string,
  reservations: ParkingReservation[],
  resolveName?: (id: string) => string
): string | null {
  const match = reservations.find(
    (r) => r.date === date && (r.status === 'approved' || r.status === 'pending')
  );
  if (!match) return null;
  const name = resolveName ? resolveName(match.requestedBy) : match.requestedBy;
  return match.status === 'approved'
    ? `Already reserved by ${name}`
    : `${name} already has a pending request`;
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

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`parking:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_sessions', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_reservations', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_reservation_votes', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      claim: async (userId, displayName, houseId): Promise<void> => {
        if (!userId) throw new Error('User ID is required to claim parking');
        const { data: existing } = await supabase
          .from('parking_sessions')
          .select('id, occupant')
          .eq('house_id', houseId)
          .eq('is_active', true)
          .maybeSingle();
        if (existing) throw new Error('Parking spot is already taken');

        const { data, error } = await supabase
          .from('parking_sessions')
          .insert({ house_id: houseId, occupant: userId, is_active: true })
          .select()
          .single();
        if (error) { captureError(error, { context: 'claim-parking', houseId }); throw new Error('Could not claim the parking spot. Please try again.'); }
        set({ current: { id: data.id, occupant: data.occupant, startTime: data.start_time } });
        notifyHousemates({
          houseId,
          excludeUserId: userId,
          title: '🚗 Parking claimed',
          body: `${displayName} is using the parking spot`,
          data: { screen: 'parking' },
          notificationType: 'parking_claimed',
        });
      },
      release: async (houseId: string): Promise<void> => {
        const current = get().current;
        if (!current) return;
        const { error } = await supabase
          .from('parking_sessions')
          .update({ is_active: false })
          .eq('id', current.id)
          .eq('house_id', houseId);
        if (error) { captureError(error, { context: 'release-parking', houseId }); throw new Error('Could not release the parking spot. Please try again.'); }
        set({ current: null });
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? '';
        if (userId) {
          notifyHousemates({
            houseId,
            excludeUserId: userId,
            title: '🅿️ Parking free',
            body: 'The parking spot is now free',
            data: { screen: 'parking' },
            notificationType: 'parking_claimed',
          });
        }
      },
      addReservation: async (data, displayName, houseId): Promise<string> => {
        const conflict = get().reservations.find(
          (r) => r.date === data.date && (r.status === 'approved' || r.status === 'pending')
        );
        if (conflict) {
          throw new Error(
            conflict.status === 'approved'
              ? 'This date is already reserved'
              : 'Someone already has a pending request for this date'
          );
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
        if (error) { captureError(error, { context: 'add-reservation', houseId }); throw new Error('Could not save the reservation. Please try again.'); }
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
        set({ reservations: [r, ...get().reservations] });
        const timeStr = data.startTime ? ` at ${data.startTime}${data.endTime ? `–${data.endTime}` : ''}` : '';
        notifyHousemates({
          houseId,
          excludeUserId: data.requestedBy,
          title: '🚗 Parking request',
          body: `${displayName} wants the spot on ${data.date}${timeStr}${data.note ? ` — ${data.note}` : ''}`,
          data: { screen: 'parking' },
          notificationType: 'parking_reservation',
        });
        return r.id;
      },
      cancelReservation: async (id, houseId): Promise<void> => {
        const reservation = get().reservations.find((r) => r.id === id);
        const { error } = await supabase.from('parking_reservations').delete().eq('id', id);
        if (error) { captureError(error, { context: 'cancel-reservation' }); throw new Error('Could not cancel the reservation. Please try again.'); }
        set({ reservations: get().reservations.filter((r) => r.id !== id) });
        const current = get().current;
        if (reservation && current && current.occupant === reservation.requestedBy) {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          if (reservation.date === todayStr) {
            await get().release(houseId);
          }
        }
      },
      voteOnReservation: async (reservationId, vote, houseId): Promise<ParkingReservationStatus> => {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? '';
        if (!userId) throw new Error('Not signed in');

        // Guard: only allow voting on pending reservations
        const localReservation = get().reservations.find((r) => r.id === reservationId);
        if (!localReservation) throw new Error('Reservation not found');
        if (localReservation.status !== 'pending') throw new Error('This request is no longer pending');

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

        // All members except the requester must vote
        const voterIds = (memberRows ?? [])
          .map((m: { user_id: string }) => m.user_id)
          .filter((id: string) => id !== localReservation.requestedBy);

        const votes = allVotes ?? [];
        const anyRejected = votes.some((v) => v.vote === 'reject');
        const votedIds = new Set(votes.map((v) => v.user_id));
        const allVoted = voterIds.length > 0 && voterIds.every((id: string) => votedIds.has(id));

        let newStatus: ParkingReservationStatus = 'pending';
        if (anyRejected) {
          newStatus = 'rejected';
        } else if (allVoted) {
          newStatus = 'approved';
        }

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
              title: '✅ Parking approved',
              body: `Parking spot confirmed for ${localReservation.date}${localReservation.startTime ? ` at ${localReservation.startTime}` : ''}`,
              data: { screen: 'parking' },
              notificationType: 'parking_reservation',
            });
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
      },
      clearHistoryItem: async (id): Promise<void> => {
        const { error } = await supabase.from('parking_reservations').delete().eq('id', id);
        if (error) {
          captureError(error, { context: 'clear-history-item', id });
          throw new Error('Could not clear this item. Please try again.');
        }
        set({ reservations: get().reservations.filter((r) => r.id !== id) });
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
