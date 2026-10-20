import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Alert } from '@lib/alert';
import { useAuthStore } from '@stores/authStore';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useHousematesStore } from '@stores/housematesStore';
import {
  useParkingStore,
  type ParkingReservationStatus,
  type ParkingVoteChoice,
} from '@stores/parkingStore';
import { getErrorMessage } from '@utils/errors';
import { resolveName } from '@utils/housemates';

export interface ParkingActions {
  error: string;
  now: Date;
  handleClaim: () => Promise<void>;
  handleRelease: () => Promise<void>;
  handleReleaseOther: () => void;
  handleCancel: (id: string) => Promise<void>;
  handleVote: (id: string, vote: ParkingVoteChoice) => Promise<void>;
  handleClear: (id: string) => Promise<void>;
  handleClearAll: () => void;
}

/**
 * Everything the parking screen does: claim / release the spot, vote, cancel
 * and clear reservations, keep "now" ticking so voting windows close on time,
 * and keep the requester's calendar in step when their request is resolved.
 */
export function useParkingActions(): ParkingActions {
  const { t } = useTranslation();
  const current = useParkingStore((s) => s.current);
  const reservations = useParkingStore((s) => s.reservations);
  const claim = useParkingStore((s) => s.claim);
  const release = useParkingStore((s) => s.release);
  const cancelReservation = useParkingStore((s) => s.cancelReservation);
  const voteOnReservation = useParkingStore((s) => s.voteOnReservation);
  const clearHistoryItem = useParkingStore((s) => s.clearHistoryItem);
  const clearAllHistory = useParkingStore((s) => s.clearAllHistory);
  const checkReservationAutoApply = useParkingStore((s) => s.checkReservationAutoApply);
  const profile = useAuthStore((s) => s.profile);
  const houseId = useAuthStore((s) => s.houseId);
  const housemates = useHousematesStore((s) => s.housemates);
  const syncParkingApproved = useCalendarSyncStore((s) => s.syncParkingApproved);
  const removeCalendarEvent = useCalendarSyncStore((s) => s.removeCalendarEvent);
  const myId = profile?.id ?? '';
  const myName = profile?.name ?? '';
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (!houseId) return;
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current !== 'active' && nextState === 'active') {
        checkReservationAutoApply(houseId);
        setNow(new Date());
      }
      appStateRef.current = nextState;
    });
    const interval = setInterval(() => {
      checkReservationAutoApply(houseId ?? '');
      setNow(new Date());
    }, 60_000);
    return (): void => {
      sub.remove();
      clearInterval(interval);
    };
  }, [houseId, checkReservationAutoApply]);

  // Sync the requester's own calendar entry when their request is resolved.
  // Voters already call syncParkingApproved in handleVote; this effect handles
  // the requester's device where the status change arrives via realtime.
  const prevStatusMapRef = useRef<Map<string, ParkingReservationStatus>>(new Map());
  useEffect(() => {
    const prevMap = prevStatusMapRef.current;
    for (const r of reservations) {
      const prev = prevMap.get(r.id);
      if (
        (prev === undefined || prev === 'pending') &&
        r.status !== 'pending' &&
        r.requestedBy === myId
      ) {
        if (r.status === 'approved') {
          syncParkingApproved({
            id: r.id,
            requestedBy: myName,
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime,
          }).catch(() => {});
        } else {
          removeCalendarEvent(`pk-${r.id}`).catch(() => {});
        }
      }
      prevMap.set(r.id, r.status);
    }
  }, [reservations, myId, myName, syncParkingApproved, removeCalendarEvent]);

  const claimingRef = useRef(false);
  const handleClaim = useCallback(async (): Promise<void> => {
    if (claimingRef.current) return; // guard against a double-tap claiming twice
    claimingRef.current = true;
    setError('');
    try {
      await claim(myId, myName, houseId ?? '');
    } catch (err) {
      setError(getErrorMessage(err, t('parking.failed_claim')));
    } finally {
      claimingRef.current = false;
    }
  }, [claim, myId, myName, houseId, t]);

  const handleRelease = useCallback(async (): Promise<void> => {
    setError('');
    try {
      await release(houseId ?? '', myName);
    } catch (err) {
      setError(getErrorMessage(err, t('parking.failed_release')));
    }
  }, [release, houseId, myName, t]);

  const handleReleaseOther = useCallback((): void => {
    const pinnedSessionId = current?.id ?? '';
    const occupantName = resolveName(current?.occupant ?? '', housemates, t('common.unknown'));
    const pinnedHouseId = houseId ?? '';
    const doRelease = (): void => {
      if (useParkingStore.getState().current?.id !== pinnedSessionId) {
        Alert.alert(t('parking.could_not_free'), t('parking.spot_changed'));
        return;
      }
      release(pinnedHouseId, myName).catch(() => {
        Alert.alert(t('parking.could_not_free'), t('parking.failed_release'));
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('parking.evict_confirm', { name: occupantName }))) {
        doRelease();
      }
    } else {
      Alert.alert(t('parking.kick_out_title', { name: occupantName }), t('parking.kick_out_body'), [
        { text: t('parking.leave_it'), style: 'cancel' },
        { text: t('parking.free_it_anyway'), style: 'destructive', onPress: doRelease },
      ]);
    }
  }, [current, housemates, myName, release, houseId, t]);

  const handleCancel = useCallback(
    async (id: string): Promise<void> => {
      try {
        await cancelReservation(id, houseId ?? '');
        removeCalendarEvent(`pk-${id}`).catch(() => {});
      } catch (err) {
        setError(getErrorMessage(err, t('parking.failed_cancel')));
      }
    },
    [cancelReservation, houseId, removeCalendarEvent, t]
  );

  const handleVote = useCallback(
    async (id: string, vote: ParkingVoteChoice): Promise<void> => {
      const reservation = reservations.find((r) => r.id === id);
      if (!reservation) return;
      try {
        const resultStatus = await voteOnReservation(id, vote, houseId ?? '');
        if (resultStatus === 'approved') {
          syncParkingApproved({
            id: reservation.id,
            requestedBy: resolveName(reservation.requestedBy, housemates),
            date: reservation.date,
            startTime: reservation.startTime,
            endTime: reservation.endTime,
          }).catch(() => {});
        }
      } catch (err) {
        setError(getErrorMessage(err, t('parking.error_vote_failed')));
      }
    },
    [voteOnReservation, reservations, housemates, houseId, syncParkingApproved, t]
  );

  const handleClear = useCallback(
    async (id: string): Promise<void> => {
      try {
        await clearHistoryItem(id);
      } catch (err) {
        setError(getErrorMessage(err, t('parking.error_clear_failed')));
      }
    },
    [clearHistoryItem, t]
  );

  const handleClearAll = useCallback((): void => {
    const doDelete = (): void => {
      clearAllHistory(houseId ?? '').catch((err: unknown) => {
        setError(getErrorMessage(err, t('parking.error_clear_all_failed')));
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(t('parking.clear_all_confirm_msg'))) doDelete();
    } else {
      Alert.alert(t('parking.clear_all_confirm_title'), t('parking.clear_all_confirm_msg'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('parking.clear_all'), style: 'destructive', onPress: doDelete },
      ]);
    }
  }, [clearAllHistory, houseId, t]);

  return {
    error,
    now,
    handleClaim,
    handleRelease,
    handleReleaseOther,
    handleCancel,
    handleVote,
    handleClear,
    handleClearAll,
  };
}
