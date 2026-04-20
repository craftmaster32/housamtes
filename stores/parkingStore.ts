import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';

export interface ParkingSession {
  id: string;
  occupant: string;
  startTime: string;
}

export interface ParkingReservation {
  id: string;
  requestedBy: string;
  date: string;
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  note: string;
  status: 'pending' | 'approved';
  createdAt: string;
}

interface ParkingStore {
  current: ParkingSession | null;
  reservations: ParkingReservation[];
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  claim: (name: string, houseId: string) => Promise<void>;
  release: (houseId: string) => Promise<void>;
  addReservation: (
    r: Omit<ParkingReservation, 'id' | 'createdAt' | 'status'>,
    houseId: string
  ) => Promise<string>; // returns new reservation ID
  cancelReservation: (id: string, houseId: string) => Promise<void>;
  approveReservation: (id: string, houseId: string) => Promise<void>;
  checkReservationAutoApply: (houseId: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;

export function isDateConflict(date: string, reservations: ParkingReservation[]): string | null {
  const match = reservations.find(
    (r) => r.date === date && (r.status === 'approved' || r.status === 'pending')
  );
  if (!match) return null;
  return match.status === 'approved'
    ? `Already reserved by ${match.requestedBy}`
    : `${match.requestedBy} already has a pending request`;
}

export const useParkingStore = create<ParkingStore>()(
  devtools(
    (set, get) => ({
      current: null,
      reservations: [],
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
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
              .select('*')
              .eq('house_id', houseId)
              .order('date'),
          ]);
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
            status: r.status as 'pending' | 'approved',
            createdAt: r.created_at,
          }));
          set({ current, reservations, isLoading: false });
          await get().checkReservationAutoApply(houseId);
        } catch {
          set({ isLoading: false });
        }

        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`parking:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_sessions', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_reservations', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      claim: async (name, houseId): Promise<void> => {
        if (!name.trim()) throw new Error('Name is required to claim parking');
        // Check server-side for an active session before inserting to prevent race-condition duplicates
        const { data: existing } = await supabase
          .from('parking_sessions')
          .select('id, occupant')
          .eq('house_id', houseId)
          .eq('is_active', true)
          .maybeSingle();
        if (existing) throw new Error(`${existing.occupant} already has the spot`);

        const { data, error } = await supabase
          .from('parking_sessions')
          .insert({ house_id: houseId, occupant: name, is_active: true })
          .select()
          .single();
        if (error) throw new Error(`Failed to claim parking: ${error.message}`);
        set({ current: { id: data.id, occupant: data.occupant, startTime: data.start_time } });
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? '';
        notifyHousemates({
          houseId,
          excludeUserId: userId,
          title: '🚗 Parking claimed',
          body: `${name} is using the parking spot`,
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
        if (error) throw new Error(`Failed to release parking: ${error.message}`);
        set({ current: null });
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? '';
        notifyHousemates({
          houseId,
          excludeUserId: userId,
          title: '🅿️ Parking free',
          body: 'The parking spot is now free',
          data: { screen: 'parking' },
          notificationType: 'parking_claimed',
        });
      },
      addReservation: async (data, houseId): Promise<string> => {
        const conflict = get().reservations.find(
          (r) => r.date === data.date && (r.status === 'approved' || r.status === 'pending')
        );
        if (conflict) {
          throw new Error(
            conflict.status === 'approved'
              ? `This date is already reserved by ${conflict.requestedBy}`
              : `${conflict.requestedBy} already has a pending request for this date`
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
        if (error) throw new Error(`Failed to add reservation: ${error.message}`);
        const r: ParkingReservation = {
          id: inserted.id,
          requestedBy: inserted.requested_by,
          date: inserted.date,
          startTime: inserted.start_time ?? undefined,
          endTime: inserted.end_time ?? undefined,
          note: inserted.note ?? '',
          status: 'pending',
          createdAt: inserted.created_at,
        };
        set({ reservations: [r, ...get().reservations] });
        const reservationId = r.id;
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? '';
        const timeStr = data.startTime ? ` at ${data.startTime}${data.endTime ? `–${data.endTime}` : ''}` : '';
        notifyHousemates({
          houseId,
          excludeUserId: userId,
          title: '🚗 Parking request',
          body: `${data.requestedBy} wants the spot on ${data.date}${timeStr}${data.note ? ` — ${data.note}` : ''}`,
          data: { screen: 'parking' },
          notificationType: 'parking_reservation',
        });
        return reservationId;
      },
      cancelReservation: async (id, houseId): Promise<void> => {
        const reservation = get().reservations.find((r) => r.id === id);
        const { error } = await supabase.from('parking_reservations').delete().eq('id', id);
        if (error) throw new Error(`Failed to cancel reservation: ${error.message}`);
        set({ reservations: get().reservations.filter((r) => r.id !== id) });
        // Auto-release if the cancelled reservation's person is currently parked via that reservation
        const current = get().current;
        if (reservation && current && current.occupant === reservation.requestedBy) {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          if (reservation.date === todayStr) {
            await get().release(houseId);
          }
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
          // Verify server-side that no active session exists before auto-inserting
          // (guards against concurrent calls from AppState + interval firing together)
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
      approveReservation: async (id, houseId): Promise<void> => {
        const { error } = await supabase.from('parking_reservations').update({ status: 'approved' }).eq('id', id);
        if (error) throw new Error(`Failed to approve reservation: ${error.message}`);
        const reservation = get().reservations.find((r) => r.id === id);
        set({
          reservations: get().reservations.map((r) =>
            r.id === id ? { ...r, status: 'approved' as const } : r
          ),
        });

        if (reservation) {
          const { data: sessionData } = await supabase.auth.getSession();
          const approverId = sessionData.session?.user.id ?? '';
          notifyHousemates({
            houseId,
            excludeUserId: approverId,
            title: '✅ Parking approved',
            body: `${reservation.requestedBy}'s spot on ${reservation.date} is confirmed${reservation.startTime ? ` at ${reservation.startTime}` : ''}`,
            data: { screen: 'parking' },
            notificationType: 'parking_reservation',
          });
        }
      },
    }),
    { name: 'parking-store' }
  )
);
