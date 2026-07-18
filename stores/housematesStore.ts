import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { useAuthStore } from '@stores/authStore';
import type { MemberRole, MemberPermissions } from '@stores/authStore';

export type { MemberRole, MemberPermissions };

export interface Housemate {
  id: string;
  memberId: string; // house_members.id (for permission updates)
  name: string;
  color: string;
  avatarUrl?: string;
  role: MemberRole;
  permissions: MemberPermissions;
  joinedAt: string | null;
}

/** Someone who used to be in the house (left or was removed). Their account
 *  may still exist; we keep their name so history can show "Alex (left)". */
export interface FormerMember {
  id: string; // user_id
  name: string;
  color: string;
  reason: 'left' | 'removed';
  leftAt: string | null;
}

interface HousematesStore {
  housemates: Housemate[];
  formerMembers: FormerMember[];
  houseName: string;
  inviteCode: string;
  timezone: string;
  isSetup: boolean;
  isLoading: boolean;
  error: string | null;
  load: (houseId: string) => Promise<void>;
  clearError: () => void;
  unsubscribe: () => void;
  save: (housemates: Housemate[]) => Promise<void>;
  updatePermissions: (memberId: string, permissions: MemberPermissions) => Promise<void>;
  updateRole: (memberId: string, role: MemberRole) => Promise<void>;
  updateTimezone: (houseId: string, tz: string) => Promise<void>;
  removeMember: (houseId: string, userId: string, name: string, color: string) => Promise<void>;
}

export const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

let _channel: ReturnType<typeof supabase.channel> | null = null;
let _channelHouseId: string | null = null;
// Bumped on every load() and unsubscribe(). An in-flight load compares its own
// sequence number against this before committing state or (re)subscribing, so a
// stale load can neither overwrite newer data nor recreate a channel after cleanup.
let _loadSeq = 0;

export const useHousematesStore = create<HousematesStore>()(
  devtools(
    (set, get) => ({
      housemates: [],
      formerMembers: [],
      houseName: '',
      inviteCode: '',
      timezone: 'UTC',
      isSetup: false,
      isLoading: true,
      error: null,
      clearError: (): void => set({ error: null }),
      load: async (houseId: string): Promise<void> => {
        if (houseId !== useAuthStore.getState().houseId) {
          console.warn('[housemates] house ID mismatch — aborting load');
          set({ isLoading: false });
          return;
        }
        const seq = ++_loadSeq;
        try {
          const [membersRes, houseRes, formerRes] = await Promise.all([
            supabase
              .from('house_members')
              .select('id, user_id, role, permissions, joined_at')
              .eq('house_id', houseId),
            supabase
              .from('houses')
              .select('name, invite_code, timezone')
              .eq('id', houseId)
              .single(),
            supabase
              .from('former_members')
              .select('user_id, name, avatar_color, left_reason, left_at')
              .eq('house_id', houseId),
          ]);

          const defaultPerms: MemberPermissions = {
            bills: true,
            grocery: true,
            parking: true,
            chores: true,
            chat: true,
            photos: true,
            voting: true,
            maintenance: true,
            condition: true,
          };

          const memberRows = membersRes.data ?? [];
          const userIds = memberRows.map((m) => m.user_id as string);

          // Fetch profiles separately to avoid relying on an indirect FK join
          // (house_members.user_id → auth.users ← profiles.id) that PostgREST
          // may not resolve, causing all profiles to silently return null.
          const profilesRes =
            userIds.length > 0
              ? await supabase
                  .from('profiles')
                  .select('id, name, avatar_color, avatar_url')
                  .in('id', userIds)
              : {
                  data: [] as {
                    id: string;
                    name: string;
                    avatar_color: string;
                    avatar_url: string | null;
                  }[],
                };

          const profileMap = new Map<
            string,
            { id: string; name: string; avatar_color: string; avatar_url: string | null }
          >((profilesRes.data ?? []).map((p) => [p.id, p]));

          // Generate signed avatar URLs in parallel for members who have one
          const signedUrls = new Map<string, string>();
          await Promise.all(
            (profilesRes.data ?? [])
              .filter((p) => p.avatar_url)
              .map(async (p) => {
                const { data, error } = await supabase.storage
                  .from('profiles')
                  .createSignedUrl(`${p.id}/avatar`, 60 * 60 * 24 * 7);
                if (data?.signedUrl) {
                  signedUrls.set(p.id, data.signedUrl);
                } else if (error) {
                  captureError(error, {
                    store: 'housemates',
                    context: 'avatar-signed-url',
                    userId: p.id,
                  });
                }
              })
          );

          const housemates: Housemate[] = memberRows
            .map((m) => {
              const p = profileMap.get(m.user_id as string);
              if (!p) return null;
              return {
                id: p.id,
                memberId: m.id as string,
                name: p.name,
                color: p.avatar_color,
                avatarUrl: signedUrls.get(p.id),
                role: ((m.role as MemberRole | undefined) ?? 'member') as MemberRole,
                permissions: { ...defaultPerms, ...(m.permissions as Partial<MemberPermissions>) },
                joinedAt: (m.joined_at as string | undefined) ?? null,
              };
            })
            .filter((h) => h !== null) as Housemate[];

          // A failed former-members query resolves with { error } rather than
          // throwing; log it so we don't silently drop every "(left)" label.
          // Non-fatal — the current-member list is what the screen mainly needs.
          if (formerRes.error) {
            captureError(formerRes.error, {
              store: 'housemates',
              context: 'load-former-members',
              houseId,
            });
          }

          // Departed members — exclude anyone who has since re-joined (they're
          // a current member again, so their old "left" row is stale). Use the
          // raw membership rows, not `housemates`, so a member whose profile
          // lookup failed isn't mistaken for someone who left.
          const currentIds = new Set(userIds);
          const formerMembers: FormerMember[] = (formerRes.data ?? [])
            .filter((f) => !currentIds.has(f.user_id as string))
            .map((f) => ({
              id: f.user_id as string,
              name: (f.name as string | null) ?? 'Housemate',
              color: (f.avatar_color as string | null) ?? '#9ca3af',
              reason: ((f.left_reason as string | undefined) === 'removed'
                ? 'removed'
                : 'left') as FormerMember['reason'],
              leftAt: (f.left_at as string | undefined) ?? null,
            }));

          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({
            housemates,
            formerMembers,
            houseName: houseRes.data?.name ?? '',
            inviteCode: houseRes.data?.invite_code ?? '',
            timezone: houseRes.data?.timezone ?? 'UTC',
            isSetup: housemates.length >= 1,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          captureError(err, { store: 'housemates', houseId });
          // A newer load (or unsubscribe) superseded this one — drop its result.
          if (seq !== _loadSeq) return;
          set({
            isSetup: false,
            isLoading: false,
            error: 'Could not load your housemates. Please try again.',
          });
        }

        // Re-fetch when someone joins or leaves the house
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
          .channel(`housemates:${houseId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'house_members',
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
      save: async (): Promise<void> => {
        // No-op: housemates are real users managed by Supabase auth + house_members table
      },
      updatePermissions: async (memberId, permissions): Promise<void> => {
        const { error } = await supabase
          .from('house_members')
          .update({ permissions })
          .eq('id', memberId);
        if (error) {
          captureError(error, { context: 'update-permissions', memberId });
          throw new Error('Could not update permissions. Please try again.');
        }
        set({
          housemates: get().housemates.map((h) =>
            h.memberId === memberId ? { ...h, permissions } : h
          ),
        });
      },
      updateRole: async (memberId, role): Promise<void> => {
        const { error } = await supabase.from('house_members').update({ role }).eq('id', memberId);
        if (error) {
          captureError(error, { context: 'update-role', memberId });
          throw new Error('Could not update role. Please try again.');
        }
        set({
          housemates: get().housemates.map((h) => (h.memberId === memberId ? { ...h, role } : h)),
        });
      },
      updateTimezone: async (houseId: string, tz: string): Promise<void> => {
        const { error } = await supabase.from('houses').update({ timezone: tz }).eq('id', houseId);
        if (error) {
          captureError(error, { context: 'update-timezone', houseId });
          throw new Error('Could not update timezone. Please try again.');
        }
        set({ timezone: tz });
      },
      removeMember: async (houseId, userId, name, color): Promise<void> => {
        // Snapshot the person first so their past bills/messages keep showing
        // "Name (left)" instead of a blank. If the snapshot fails, abort before
        // deleting the membership — otherwise we'd lose the name forever.
        const now = new Date().toISOString();
        try {
          const { error: snapshotError } = await supabase.from('former_members').upsert(
            {
              house_id: houseId,
              user_id: userId,
              name,
              avatar_color: color,
              left_reason: 'removed',
              left_at: now,
              updated_at: now,
            },
            { onConflict: 'house_id,user_id' }
          );
          if (snapshotError) throw snapshotError;

          const { error } = await supabase
            .from('house_members')
            .delete()
            .eq('house_id', houseId)
            .eq('user_id', userId);
          if (error) throw error;
        } catch (err) {
          // Covers both returned Supabase errors and thrown client/network
          // failures, so every failure path gets Sentry context + a clean message.
          captureError(err, { context: 'remove-member', houseId, userId });
          throw new Error('Could not remove this member. Please try again.');
        }
        // Realtime on house_members will trigger a reload; update locally too.
        set({
          housemates: get().housemates.filter((h) => h.id !== userId),
          formerMembers: [
            ...get().formerMembers.filter((f) => f.id !== userId),
            { id: userId, name, color, reason: 'removed', leftAt: new Date().toISOString() },
          ],
        });
      },
    }),
    { name: 'housemates-store' }
  )
);
