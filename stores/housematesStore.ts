import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { supabase } from '@lib/supabase';
import type { MemberRole, MemberPermissions } from '@stores/authStore';

export type { MemberRole, MemberPermissions };

export interface Housemate {
  id: string;
  memberId: string; // house_members.id (for permission updates)
  name: string;
  color: string;
  role: MemberRole;
  permissions: MemberPermissions;
}

interface HousematesStore {
  housemates: Housemate[];
  houseName: string;
  inviteCode: string;
  isSetup: boolean;
  isLoading: boolean;
  load: (houseId: string) => Promise<void>;
  unsubscribe: () => void;
  save: (housemates: Housemate[]) => Promise<void>;
  updatePermissions: (memberId: string, permissions: MemberPermissions) => Promise<void>;
  updateRole: (memberId: string, role: MemberRole) => Promise<void>;
}

export const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6'];

let _channel: ReturnType<typeof supabase.channel> | null = null;

export const useHousematesStore = create<HousematesStore>()(
  devtools(
    (set, get) => ({
      housemates: [],
      houseName: '',
      inviteCode: '',
      isSetup: false,
      isLoading: true,
      load: async (houseId: string): Promise<void> => {
        try {
          const [membersRes, houseRes] = await Promise.all([
            supabase
              .from('house_members')
              .select('id, user_id, role, permissions')
              .eq('house_id', houseId),
            supabase
              .from('houses')
              .select('name, invite_code')
              .eq('id', houseId)
              .single(),
          ]);

          const defaultPerms: MemberPermissions = {
            bills: true, grocery: true, parking: true, chores: true,
            chat: true, photos: true, voting: true, maintenance: true, condition: true,
          };

          const memberRows = membersRes.data ?? [];
          const userIds = memberRows.map((m) => m.user_id as string);

          // Fetch profiles separately to avoid relying on an indirect FK join
          // (house_members.user_id → auth.users ← profiles.id) that PostgREST
          // may not resolve, causing all profiles to silently return null.
          const profilesRes = userIds.length > 0
            ? await supabase.from('profiles').select('id, name, avatar_color').in('id', userIds)
            : { data: [] as { id: string; name: string; avatar_color: string }[] };

          const profileMap = new Map<string, { id: string; name: string; avatar_color: string }>(
            (profilesRes.data ?? []).map((p) => [p.id, p])
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
                role: ((m.role as MemberRole | undefined) ?? 'member') as MemberRole,
                permissions: { ...defaultPerms, ...(m.permissions as Partial<MemberPermissions>) },
              };
            })
            .filter((h): h is Housemate => h !== null);

          set({
            housemates,
            houseName: houseRes.data?.name ?? '',
            inviteCode: houseRes.data?.invite_code ?? '',
            isSetup: housemates.length >= 1,
            isLoading: false,
          });
        } catch {
          set({ isSetup: false, isLoading: false });
        }

        // Re-fetch when someone joins or leaves the house
        if (_channel) { supabase.removeChannel(_channel); }
        _channel = supabase
          .channel(`housemates:${houseId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'house_members', filter: `house_id=eq.${houseId}` },
            () => { get().load(houseId); })
          .subscribe();
      },
      unsubscribe: (): void => {
        if (_channel) { supabase.removeChannel(_channel); _channel = null; }
      },
      save: async (): Promise<void> => {
        // No-op: housemates are real users managed by Supabase auth + house_members table
      },
      updatePermissions: async (memberId, permissions): Promise<void> => {
        const { error } = await supabase.from('house_members').update({ permissions }).eq('id', memberId);
        if (error) throw new Error(`Failed to update permissions: ${error.message}`);
        set({
          housemates: get().housemates.map((h) =>
            h.memberId === memberId ? { ...h, permissions } : h
          ),
        });
      },
      updateRole: async (memberId, role): Promise<void> => {
        const { error } = await supabase.from('house_members').update({ role }).eq('id', memberId);
        if (error) throw new Error(`Failed to update role: ${error.message}`);
        set({
          housemates: get().housemates.map((h) =>
            h.memberId === memberId ? { ...h, role } : h
          ),
        });
      },
    }),
    { name: 'housemates-store' }
  )
);
