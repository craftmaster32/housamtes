import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalendarSyncStore } from '@stores/calendarSyncStore';
import { useHousematesStore } from '@stores/housematesStore';
import {
  useParkingStore,
  isDateConflict,
  type ConflictResult,
  type ParkingReservation,
  type ParkingSession,
} from '@stores/parkingStore';
import { resolveName } from '@utils/housemates';
import { todayString } from '@utils/parkingDates';

interface ReserveFormOptions {
  myId: string;
  myName: string;
  houseId: string;
  reservations: ParkingReservation[];
  current: ParkingSession | null;
  /** Called after a successful request (the sheet resets and closes). */
  onDone: () => void;
}

export interface ReserveForm {
  date: string;
  startTime: string;
  endTime: string;
  note: string;
  saving: boolean;
  error: string;
  dateConflict: string | null | undefined;
  /** What the blue sticky note says: a hard clash alone, else any warnings. */
  stickyLines: string[];
  setDate: (d: string) => void;
  setStartTime: (t: string) => void;
  setEndTime: (t: string) => void;
  setNote: (n: string) => void;
  reset: () => void;
  handleSave: () => Promise<void>;
}

/**
 * The "Reserve Parking" form: its fields, clash checks against other
 * reservations and the spot's current use, validation and saving.
 */
export function useReserveForm({
  myId,
  myName,
  houseId,
  reservations,
  current,
  onDone,
}: ReserveFormOptions): ReserveForm {
  const { t } = useTranslation();
  const addReservation = useParkingStore((s) => s.addReservation);
  const syncParkingPending = useCalendarSyncStore((s) => s.syncParkingPending);
  const housemates = useHousematesStore((s) => s.housemates);
  const todayStr = todayString();
  const [date, setDateRaw] = useState(todayStr);
  const [startTime, setStartRaw] = useState('');
  const [endTime, setEndRaw] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeConflict =
    current && date === todayStr
      ? current.occupant === myId
        ? t('parking.currently_using_you')
        : t('parking.currently_using_other', {
            name: resolveName(current.occupant, housemates, t('common.unknown')),
          })
      : null;
  const conflictResult: ConflictResult = isDateConflict(
    date,
    startTime || undefined,
    endTime || undefined,
    reservations,
    (id: string): string => resolveName(id, housemates, t('common.unknown'))
  );
  const dateConflict = conflictResult.conflict;
  const dateWarning = conflictResult.warning;
  // A hard clash replaces everything else; otherwise any softer warnings show.
  const stickyLines = dateConflict
    ? [dateConflict]
    : [dateWarning, activeConflict].filter((s): s is string => !!s);

  // Changing the date or a time clears an old error message.
  const setDate = useCallback((d: string): void => {
    setDateRaw(d);
    setError('');
  }, []);
  const setStartTime = useCallback((v: string): void => {
    setStartRaw(v);
    setError('');
  }, []);
  const setEndTime = useCallback((v: string): void => {
    setEndRaw(v);
    setError('');
  }, []);

  const reset = useCallback((): void => {
    setDateRaw(todayStr);
    setStartRaw('');
    setEndRaw('');
    setNote('');
    setError('');
  }, [todayStr]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (saving) return; // guard against a double-tap creating two reservations
    if (dateConflict) {
      setError(dateConflict);
      return;
    }
    if (!!startTime !== !!endTime) {
      setError(t('parking.error_both_times'));
      return;
    }
    if (startTime && endTime && endTime <= startTime) {
      setError(t('parking.error_end_before_start'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const reservationId = await addReservation(
        {
          requestedBy: myId,
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          note,
        },
        myName,
        houseId
      );
      syncParkingPending({
        id: reservationId,
        requestedBy: myName,
        date,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
      }).catch(() => {});
      reset();
      onDone();
    } catch {
      setError(t('parking.failed_reservation'));
    } finally {
      setSaving(false);
    }
  }, [
    dateConflict,
    date,
    startTime,
    endTime,
    note,
    myId,
    myName,
    houseId,
    addReservation,
    reset,
    onDone,
    syncParkingPending,
    t,
    saving,
  ]);

  return {
    date,
    startTime,
    endTime,
    note,
    saving,
    error,
    dateConflict,
    stickyLines,
    setDate,
    setStartTime,
    setEndTime,
    setNote,
    reset,
    handleSave,
  };
}
