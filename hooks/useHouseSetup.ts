import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@stores/authStore';
import { COLORS } from '@stores/housematesStore';
import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { getErrorMessage } from '@utils/errors';

const ONBOARDING_INTENT_KEY = 'onboarding_intent';

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export type SetupMode = 'create' | 'join';

export interface PendingHouse {
  id: string;
  name: string;
  memberCount: number;
}

export interface HouseSetup {
  mode: SetupMode;
  setMode: (mode: SetupMode) => void;
  houseName: string;
  setHouseName: (name: string) => void;
  inviteCode: string;
  setInviteCode: (code: string) => void;
  isLoading: boolean;
  error: string;
  setError: (error: string) => void;
  assignedColor: string | null;
  pendingHouse: PendingHouse | null;
  showConfirm: boolean;
  setShowConfirm: (show: boolean) => void;
  signOut: () => Promise<void>;
  handleCreate: () => Promise<void>;
  handleFindHouse: () => Promise<void>;
  handleConfirmJoin: () => Promise<void>;
}

/** Everything behind the house setup screen: create a house, or find one by code and join. */
export function useHouseSetup(): HouseSetup {
  const { t } = useTranslation();
  const [mode, setMode] = useState<SetupMode>('create');
  const [houseName, setHouseName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [assignedColor, setAssignedColor] = useState<string | null>(null);
  const [pendingHouse, setPendingHouse] = useState<PendingHouse | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const joinAttemptsRef = useRef(0);
  const joinLockedUntilRef = useRef<Date | null>(null);
  const user = useAuthStore((s) => s.user);
  const setHouseId = useAuthStore((s) => s.setHouseId);
  const reloadMembership = useAuthStore((s) => s.reloadMembership);
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_INTENT_KEY)
      .then((intent) => {
        if (intent === 'join') {
          setMode('join');
          AsyncStorage.removeItem(ONBOARDING_INTENT_KEY).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const handleCreate = useCallback(async () => {
    if (isLoading) return; // guard against a double-tap creating two houses
    if (!houseName.trim()) {
      setError(t('house_setup.enter_house_name'));
      return;
    }
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      const code = generateCode();
      const timezone = getDeviceTimezone();
      const { data: house, error: houseErr } = await supabase
        .from('houses')
        .insert({ name: houseName.trim(), invite_code: code, created_by: user.id, timezone })
        .select()
        .single();
      if (houseErr) throw new Error(t('house_setup.failed_create'));

      const { error: memberErr } = await supabase
        .from('house_members')
        .insert({ house_id: house.id, user_id: user.id, role: 'owner' });
      if (memberErr) throw new Error(t('house_setup.failed_create'));

      setHouseId(house.id);
    } catch (err) {
      captureError(err, { context: 'house-create', userId: user?.id ?? '' });
      setError(getErrorMessage(err, t('house_setup.failed_create')));
      setIsLoading(false);
    }
  }, [houseName, user, setHouseId, t, isLoading]);

  const handleFindHouse = useCallback(async () => {
    if (joinLockedUntilRef.current && new Date() < joinLockedUntilRef.current) {
      const secondsLeft = Math.ceil((joinLockedUntilRef.current.getTime() - Date.now()) / 1000);
      setError(t('house_setup.too_many_attempts', { seconds: secondsLeft }));
      return;
    }
    if (!inviteCode.trim()) {
      setError(t('house_setup.enter_invite_code'));
      return;
    }
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      // Houses are no longer directly readable by non-members — lookup goes
      // through a SECURITY DEFINER RPC that requires the exact invite code.
      const { data, error: houseErr } = await supabase.rpc('find_house_by_invite_code', {
        p_code: inviteCode.trim().toUpperCase(),
      });
      if (houseErr) throw new Error(t('house_setup.failed_join'));
      const house = (
        data as { house_id: string; house_name: string; member_count: number }[] | null
      )?.[0];
      if (!house) {
        joinAttemptsRef.current += 1;
        if (joinAttemptsRef.current >= 3) {
          const lockSeconds = Math.min(10 * Math.pow(2, joinAttemptsRef.current - 3), 300);
          joinLockedUntilRef.current = new Date(Date.now() + lockSeconds * 1000);
        }
        throw new Error(t('house_setup.code_not_found'));
      }

      joinAttemptsRef.current = 0;
      joinLockedUntilRef.current = null;
      setPendingHouse({
        id: house.house_id,
        name: house.house_name,
        memberCount: house.member_count,
      });
      setShowConfirm(true);
    } catch (err) {
      captureError(err, { context: 'house-find', userId: user?.id ?? '' });
      setError(getErrorMessage(err, t('house_setup.failed_join')));
    } finally {
      setIsLoading(false);
    }
  }, [inviteCode, user, t]);

  const handleConfirmJoin = useCallback(async () => {
    if (isLoading) return; // guard against a double-tap joining twice
    if (!pendingHouse || !user) return;
    setIsLoading(true);
    setError('');
    try {
      // Join through the RPC — it re-validates the invite code server-side and
      // inserts the membership atomically (direct inserts are blocked by RLS).
      const { error: memberErr } = await supabase.rpc('join_house_by_invite_code', {
        p_code: inviteCode.trim().toUpperCase(),
      });
      if (memberErr) throw new Error(t('house_setup.failed_join'));

      await reloadMembership();

      const { data: otherMembers } = await supabase
        .from('house_members')
        .select('user_id')
        .eq('house_id', pendingHouse.id)
        .neq('user_id', user.id);

      if (otherMembers && otherMembers.length > 0) {
        const [{ data: otherProfiles }, { data: myProfile }] = await Promise.all([
          supabase
            .from('profiles')
            .select('avatar_color')
            .in(
              'id',
              otherMembers.map((m) => m.user_id)
            ),
          supabase.from('profiles').select('avatar_color').eq('id', user.id).maybeSingle(),
        ]);
        const takenColors = new Set(otherProfiles?.map((p) => p.avatar_color) ?? []);
        if (myProfile && takenColors.has(myProfile.avatar_color)) {
          const freeColor = COLORS.find((c) => !takenColors.has(c));
          if (freeColor) {
            const { error: colorErr } = await supabase
              .from('profiles')
              .update({ avatar_color: freeColor })
              .eq('id', user.id);
            if (!colorErr) {
              setAssignedColor(freeColor);
            } else {
              captureError(colorErr, { context: 'house-color-update', userId: user?.id ?? '' });
            }
          }
        }
      }

      setShowConfirm(false);
      setHouseId(pendingHouse.id);
    } catch (err) {
      captureError(err, {
        context: 'house-confirm-join',
        houseId: pendingHouse?.id ?? '',
        userId: user?.id ?? '',
      });
      setError(getErrorMessage(err, t('house_setup.failed_join')));
      setShowConfirm(false);
      setIsLoading(false);
    }
  }, [pendingHouse, user, inviteCode, reloadMembership, setHouseId, t, isLoading]);

  return {
    mode,
    setMode,
    houseName,
    setHouseName,
    inviteCode,
    setInviteCode,
    isLoading,
    error,
    setError,
    assignedColor,
    pendingHouse,
    showConfirm,
    setShowConfirm,
    signOut,
    handleCreate,
    handleFindHouse,
    handleConfirmJoin,
  };
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
