import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { notifyHousemates } from '@lib/notifyHousemates';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

// The three shared machines. Order is the canonical display order.
export type ApplianceKind = 'washer' | 'dryer' | 'dishwasher';
export const APPLIANCE_KINDS: ApplianceKind[] = ['washer', 'dryer', 'dishwasher'];

export interface ApplianceSession {
  id: string;
  appliance: ApplianceKind;
  startedBy: string; // user UUID
  label: string; // preset name or free-form note, may be empty
  startedAt: string; // ISO
  endsAt: string; // ISO — when the cycle finishes
}

export interface AppliancePreset {
  id: string;
  appliance: ApplianceKind;
  name: string;
  durationMinutes: number;
  createdBy: string;
}

// The active run for each machine (null = free). A flat record keyed by machine
// keeps selectors simple: useAppliancesStore((s) => s.sessions.washer).
export type ApplianceSessions = Record<ApplianceKind, ApplianceSession | null>;

function emptySessions(): ApplianceSessions {
  return { washer: null, dryer: null, dishwasher: null };
}

interface AppliancesStore {
  sessions: ApplianceSessions;
  presets: AppliancePreset[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  start: (params: {
    appliance: ApplianceKind;
    userId: string;
    displayName: string;
    durationMinutes: number;
    label: string;
    houseId: string;
  }) => Promise<void>;
  stop: (appliance: ApplianceKind, houseId: string, displayName?: string) => Promise<void>;
  addPreset: (params: {
    appliance: ApplianceKind;
    name: string;
    durationMinutes: number;
    userId: string;
    houseId: string;
  }) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load()/unsubscribe(); an in-flight load compares its own
// sequence number before committing state or (re)subscribing, so a stale load
// can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

// Milliseconds remaining on a running cycle (never negative).
export function remainingMs(session: ApplianceSession | null, now: Date = new Date()): number {
  if (!session) return 0;
  return Math.max(0, new Date(session.endsAt).getTime() - now.getTime());
}

// A running session whose end time has already passed reads as "just finished".
export function isFinished(session: ApplianceSession | null, now: Date = new Date()): boolean {
  return session !== null && remainingMs(session, now) === 0;
}

interface SessionRow {
  id: string;
  appliance: string;
  started_by: string;
  label: string | null;
  started_at: string;
  ends_at: string;
}

function rowToSession(row: SessionRow): ApplianceSession {
  return {
    id: row.id,
    appliance: row.appliance as ApplianceKind,
    startedBy: row.started_by,
    label: row.label ?? '',
    startedAt: row.started_at,
    endsAt: row.ends_at,
  };
}

export const useAppliancesStore = create<AppliancesStore>()(
  devtools(
    (set, get) => ({
      sessions: emptySessions(),
      presets: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),

      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[appliances] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const [sessionRes, presetRes] = await Promise.all([
            supabase
              .from('appliance_sessions')
              .select('id, appliance, started_by, label, started_at, ends_at')
              .eq('house_id', houseId)
              .eq('is_active', true),
            supabase
              .from('appliance_presets')
              .select('id, appliance, name, duration_minutes, created_by')
              .eq('house_id', houseId)
              .order('duration_minutes', { ascending: true }),
          ]);
          if (sessionRes.error) throw sessionRes.error;
          if (presetRes.error) throw presetRes.error;

          const sessions = emptySessions();
          for (const row of (sessionRes.data ?? []) as SessionRow[]) {
            const session = rowToSession(row);
            // Guard against an unexpected value slipping past the DB CHECK.
            if (APPLIANCE_KINDS.includes(session.appliance)) {
              sessions[session.appliance] = session;
            }
          }
          const presets: AppliancePreset[] = (
            (presetRes.data ?? []) as Array<{
              id: string;
              appliance: string;
              name: string;
              duration_minutes: number;
              created_by: string;
            }>
          ).map((p) => ({
            id: p.id,
            appliance: p.appliance as ApplianceKind,
            name: p.name,
            durationMinutes: p.duration_minutes,
            createdBy: p.created_by,
          }));

          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ sessions, presets, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'appliances', houseId });
          if (seq !== _loadSeq) return;
          set({ isLoading: false, error: 'Could not load machines. Please try again.' });
        }

        // Superseded while fetching — leave any existing subscription untouched.
        if (seq !== _loadSeq) return;
        if (_channel && _channelHouseId === houseId) return;
        if (_channel) supabase.removeChannel(_channel);
        _channelHouseId = houseId;
        _channel = supabase
          .channel(`appliances:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'appliance_sessions',
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
              table: 'appliance_presets',
              filter: `house_id=eq.${houseId}`,
            },
            () => {
              get().load(houseId);
            }
          )
          .subscribe();
      },

      unsubscribe: (): void => {
        _loadSeq++;
        if (_channel) {
          supabase.removeChannel(_channel);
          _channel = null;
          _channelHouseId = null;
        }
      },

      start: async ({
        appliance,
        userId,
        displayName,
        durationMinutes,
        label,
        houseId,
      }): Promise<void> => {
        if (!userId || !houseId) {
          throw new Error('Please wait while your profile loads before starting a machine.');
        }
        if (get().isLoading) throw new Error('Still loading machines, please try again');
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
          throw new Error('Please choose how long the cycle runs');
        }
        if (get().sessions[appliance]) throw new Error('This machine is already running');

        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
        const optimistic: ApplianceSession = {
          id: 'optimistic',
          appliance,
          startedBy: userId,
          label,
          startedAt: startedAt.toISOString(),
          endsAt: endsAt.toISOString(),
        };
        set((s) => ({ sessions: { ...s.sessions, [appliance]: optimistic } }));

        try {
          const { data, error } = await supabase
            .from('appliance_sessions')
            .insert({
              house_id: houseId,
              appliance,
              started_by: userId,
              label,
              ends_at: endsAt.toISOString(),
            })
            .select('id, appliance, started_by, label, started_at, ends_at')
            .single();
          if (error) {
            set((s) => ({ sessions: { ...s.sessions, [appliance]: null } }));
            captureError(error, { context: 'appliance-start', houseId, appliance });
            throw new Error('Could not start the machine. Please try again.');
          }
          set((s) => ({ sessions: { ...s.sessions, [appliance]: rowToSession(data) } }));
          void notifyHousemates({
            houseId,
            excludeUserId: userId,
            copyKey: 'appliance_started',
            copyParams: { name: displayName, appliance, minutes: durationMinutes },
            data: { screen: 'machines' },
            notificationType: 'appliance',
          }).catch((err) => captureError(err, { context: 'notify-appliance-start', houseId }));
        } catch (err) {
          set((s) => ({ sessions: { ...s.sessions, [appliance]: null } }));
          throw err;
        }
      },

      stop: async (appliance, houseId, displayName): Promise<void> => {
        const previous = get().sessions[appliance];
        if (!previous) return;
        if (previous.id === 'optimistic')
          throw new Error('Still starting up, please wait a moment');

        set((s) => ({ sessions: { ...s.sessions, [appliance]: null } }));
        try {
          // Mark done_notified so the appliance-check cron doesn't also announce
          // "free" for a session a member is closing here.
          const { data: updated, error } = await supabase
            .from('appliance_sessions')
            .update({ is_active: false, done_notified: true })
            .eq('id', previous.id)
            .eq('house_id', houseId)
            .eq('is_active', true)
            .select('id');
          if (error) throw error;
          // No row updated: the cron (or another member) already closed it. That's
          // fine — the machine is free either way, so don't resurrect the card.
          if (!updated?.length) return;

          const userId = useAuthStore.getState().profile?.id ?? '';
          void notifyHousemates({
            houseId,
            excludeUserId: userId,
            copyKey: 'appliance_free',
            copyParams: { name: displayName ?? '', appliance },
            data: { screen: 'machines' },
            notificationType: 'appliance',
          }).catch((err) => captureError(err, { context: 'notify-appliance-free', houseId }));
        } catch (err) {
          set((s) => ({ sessions: { ...s.sessions, [appliance]: previous } }));
          captureError(err, { context: 'appliance-stop', houseId, appliance });
          throw new Error('Could not stop the machine. Please try again.');
        }
      },

      addPreset: async ({ appliance, name, durationMinutes, userId, houseId }): Promise<void> => {
        if (!userId || !houseId) throw new Error('Please wait while your profile loads.');
        const trimmed = name.trim();
        if (!trimmed) throw new Error('Give the preset a name');
        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440) {
          throw new Error('Choose a duration between 1 minute and 24 hours');
        }
        try {
          const { data, error } = await supabase
            .from('appliance_presets')
            .insert({
              house_id: houseId,
              appliance,
              name: trimmed,
              duration_minutes: Math.round(durationMinutes),
              created_by: userId,
            })
            .select('id, appliance, name, duration_minutes, created_by')
            .single();
          if (error) throw error;
          const preset: AppliancePreset = {
            id: data.id,
            appliance: data.appliance as ApplianceKind,
            name: data.name,
            durationMinutes: data.duration_minutes,
            createdBy: data.created_by,
          };
          set((s) => ({ presets: [...s.presets, preset] }));
        } catch (err) {
          captureError(err, { context: 'appliance-add-preset', houseId, appliance });
          throw new Error('Could not save the preset. Please try again.');
        }
      },

      deletePreset: async (id): Promise<void> => {
        const previous = get().presets;
        set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
        try {
          const { error } = await supabase.from('appliance_presets').delete().eq('id', id);
          if (error) throw error;
        } catch (err) {
          set({ presets: previous });
          captureError(err, { context: 'appliance-delete-preset', id });
          throw new Error('Could not delete the preset. Please try again.');
        }
      },
    }),
    { name: 'appliances-store' }
  )
);
