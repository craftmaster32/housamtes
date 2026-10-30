import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
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
  /** Tap on the spot: claim it, release mine, or (after confirming) free a housemate's. */
  handleSpotPress: () => void;
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

  // Claim / release keep up with quick taps: while one is saving, further taps
  // just flip what the spot should end up as, and that runs straight after.
  // (The store can't release a claim that is still saving, so they can't overlap.)
  const busyRef = useRef(false);
  const wantMineRef = useRef<boolean | null>(null);
  const toggleMine = useCallback(async (): Promise<void> => {
    const isMineNow = (): boolean => useParkingStore.getState().current?.occupant === myId;
    if (busyRef.current) {
      wantMineRef.current = !(wantMineRef.current ?? isMineNow());
      return;
    }
    busyRef.current = true;
    wantMineRef.current = !isMineNow();
    setError('');
    try {
      // Keep going until the spot matches the last tap (or something fails).
      // A few rounds at most, so an odd server state can never loop forever.
      for (
        let round = 0;
        round < 4 && wantMineRef.current !== null && wantMineRef.current !== isMineNow();
        round++
      ) {
        const cur = useParkingStore.getState().current;
        if (cur && cur.occupant !== myId) break; // a housemate took it meanwhile
        if (wantMineRef.current) {
          try {
            await claim(myId, myName, houseId ?? '');
          } catch (err) {
            setError(getErrorMessage(err, t('parking.failed_claim')));
            break;
          }
        } else {
          try {
            await release(houseId ?? '', myName);
          } catch (err) {
            setError(getErrorMessage(err, t('parking.failed_release')));
            break;
          }
        }
      }
    } finally {
      busyRef.current = false;
      wantMineRef.current = null;
    }
  }, [claim, release, myId, myName, houseId, t]);

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
    // The app's own sticky note on web too — the browser's confirm box looked
    // out of place and spoke the phone's language instead of the app's.
    Alert.alert(t('parking.kick_out_title', { name: occupantName }), t('parking.kick_out_body'), [
      { text: t('parking.leave_it'), style: 'cancel' },
      { text: t('parking.free_it_anyway'), style: 'destructive', onPress: doRelease },
    ]);
  }, [current, housemates, myName, release, houseId, t]);

  const handleSpotPress = useCallback((): void => {
    // Immediate tactile ack so the tap feels instant, like the Home card.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const cur = useParkingStore.getState().current;
    if (cur && cur.occupant !== myId && !busyRef.current) {
      handleReleaseOther();
      return;
    }
    toggleMine().catch(() => {});
  }, [myId, handleReleaseOther, toggleMine]);

  // A second quick tap on the same Cancel / vote / bin while the first is still
  // saving is ignored, so it can't send twice and flash a false error.
  const inFlightRef = useRef(new Set<string>());
  const once = useCallback(async (key: string, run: () => Promise<void>): Promise<void> => {
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    try {
      await run();
    } finally {
      inFlightRef.current.delete(key);
    }
  }, []);

  const handleCancel = useCallback(
    (id: string): Promise<void> =>
      once(`cancel:${id}`, async () => {
        try {
          await cancelReservation(id, houseId ?? '');
          removeCalendarEvent(`pk-${id}`).catch(() => {});
        } catch (err) {
          setError(getErrorMessage(err, t('parking.failed_cancel')));
        }
      }),
    [once, cancelReservation, houseId, removeCalendarEvent, t]
  );

  const handleVote = useCallback(
    (id: string, vote: ParkingVoteChoice): Promise<void> =>
      once(`vote:${id}`, async () => {
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
      }),
    [once, voteOnReservation, reservations, housemates, houseId, syncParkingApproved, t]
  );

  const handleClear = useCallback(
    (id: string): Promise<void> =>
      once(`clear:${id}`, async () => {
        try {
          await clearHistoryItem(id);
        } catch (err) {
          setError(getErrorMessage(err, t('parking.error_clear_failed')));
        }
      }),
    [once, clearHistoryItem, t]
  );

  const handleClearAll = useCallback((): void => {
    const doDelete = (): void => {
      clearAllHistory(houseId ?? '').catch((err: unknown) => {
        setError(getErrorMessage(err, t('parking.error_clear_all_failed')));
      });
    };
    Alert.alert(t('parking.clear_all_confirm_title'), t('parking.clear_all_confirm_msg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('parking.clear_all'), style: 'destructive', onPress: doDelete },
    ]);
  }, [clearAllHistory, houseId, t]);

  return {
    error,
    now,
    handleSpotPress,
    handleReleaseOther,
    handleCancel,
    handleVote,
    handleClear,
    handleClearAll,
  };
}
