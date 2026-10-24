import { lightColors, type ColorPalette } from '@constants/colors';
import { isReservationPastDue, type ParkingReservation } from '@stores/parkingStore';

type TFunction = (key: string, options?: Record<string, unknown>) => string;

// Stamp inks for reservations written on paper. Paper stays light in dark mode,
// so these are fixed light-theme inks (the amber is darkened to read on cream).
const PAPER_INK = {
  approved: lightColors.success,
  rejected: lightColors.danger,
  pending: '#8F6512',
} as const;

export interface ReservationStatus {
  /** Text for the rubber stamp, e.g. "✓ Approved". */
  label: string;
  /** Stamp colour on paper. */
  ink: string;
  votingClosed: boolean;
}

/** What the stamp on a reservation says, and in which ink. */
export function reservationStatus(
  r: ParkingReservation,
  now: Date,
  t: TFunction
): ReservationStatus {
  const votingClosed = r.status === 'pending' && isReservationPastDue(r.date, r.startTime, now);
  if (r.status === 'approved') {
    return { label: `✓ ${t('parking.approved')}`, ink: PAPER_INK.approved, votingClosed };
  }
  if (r.status === 'rejected') {
    return { label: t('parking.rejected'), ink: PAPER_INK.rejected, votingClosed };
  }
  return {
    label: votingClosed ? t('parking.voting_closed') : t('parking.pending'),
    ink: PAPER_INK.pending,
    votingClosed,
  };
}

/** Theme colour for a reservation's dot on the day tiles. */
export function statusDotColor(r: ParkingReservation, c: ColorPalette): string {
  if (r.status === 'approved') return c.success;
  if (r.status === 'rejected') return c.danger;
  return c.warning;
}
