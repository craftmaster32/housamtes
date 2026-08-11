import type * as React from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Ionicons } from '@expo/vector-icons';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved';

export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: MaintenanceStatus;
  reportedBy: string; // user UUID
  createdAt: string;
  resolvedAt: string | null;
}

interface MaintenanceStore {
  requests: MaintenanceRequest[];
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  add: (
    data: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'resolvedAt'>,
    houseId: string
  ) => Promise<void>;
  updateStatus: (id: string, status: MaintenanceStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

export const useMaintenanceStore = create<MaintenanceStore>()(
  devtools(
    (set, get) => ({
      requests: [],
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[maintenance] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const { data, error } = await supabase
            .from('maintenance_requests')
            .select('*')
            .eq('house_id', houseId)
            .order('created_at', { ascending: false });
          if (error) throw error;
          const requests: MaintenanceRequest[] = (data ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description ?? '',
            category: r.category,
            status: r.status as MaintenanceStatus,
            reportedBy: r.reported_by,
            createdAt: r.created_at,
            resolvedAt: r.resolved_at ?? null,
          }));
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({ requests, isLoading: false, error: null });
        } catch (err) {
          captureError(err, { store: 'maintenance', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({
            isLoading: false,
            error: 'Could not load maintenance requests. Please try again.',
          });
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
          .channel(`maintenance:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'maintenance_requests',
              filter: `house_id=eq.${houseId}`,
            },
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
      add: async (data, houseId): Promise<void> => {
        const { data: inserted, error } = await supabase
          .from('maintenance_requests')
          .insert({
            house_id: houseId,
            title: data.title,
            description: data.description,
            category: data.category,
            status: data.status,
            reported_by: data.reportedBy,
          })
          .select()
          .single();
        if (error) {
          captureError(error, { context: 'add-maintenance', houseId });
          throw new Error('Could not save the request. Please try again.');
        }
        const request: MaintenanceRequest = {
          id: inserted.id,
          title: inserted.title,
          description: inserted.description ?? '',
          category: inserted.category,
          status: inserted.status as MaintenanceStatus,
          reportedBy: inserted.reported_by,
          createdAt: inserted.created_at,
          resolvedAt: null,
        };
        set({ requests: [request, ...get().requests] });
      },
      updateStatus: async (id, status): Promise<void> => {
        const resolvedAt = status === 'resolved' ? new Date().toISOString() : null;
        const { error } = await supabase
          .from('maintenance_requests')
          .update({ status, resolved_at: resolvedAt })
          .eq('id', id);
        if (error) {
          captureError(error, { context: 'update-maintenance-status', requestId: id });
          throw new Error('Could not update the status. Please try again.');
        }
        set({
          requests: get().requests.map((r) =>
            r.id === id ? { ...r, status, resolvedAt: resolvedAt ?? r.resolvedAt } : r
          ),
        });
      },
      remove: async (id): Promise<void> => {
        const { error } = await supabase.from('maintenance_requests').delete().eq('id', id);
        if (error) {
          captureError(error, { context: 'delete-maintenance', requestId: id });
          throw new Error('Could not delete the request. Please try again.');
        }
        set({ requests: get().requests.filter((r) => r.id !== id) });
      },
    }),
    { name: 'maintenance-store' }
  )
);

export const MAINTENANCE_CATEGORIES: { label: string; icon: IoniconName }[] = [
  { label: 'Plumbing', icon: 'water-outline' },
  { label: 'Electrical', icon: 'flash-outline' },
  { label: 'Appliance', icon: 'construct-outline' },
  { label: 'Structure', icon: 'home-outline' },
  { label: 'Pest', icon: 'bug-outline' },
  { label: 'Other', icon: 'document-text-outline' },
];

export const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

export const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  open: '#ef4444',
  in_progress: '#f59e0b',
  resolved: '#22c55e',
};

export const NEXT_STATUS: Record<MaintenanceStatus, MaintenanceStatus> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'open',
};
