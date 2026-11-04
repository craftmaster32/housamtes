import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { notifyHousemates } from '@lib/notifyHousemates';
import { format } from 'date-fns';
import { todayISO } from '@utils/recurringCoverage';

/** A house this new counts as "just set up": people joining now are probably founders. */
export const NEW_HOUSE_DAYS = 1;

/** Calendar day in the phone's local time (stored times are UTC). */
const dayOf = (ts: string): string => (ts.length <= 10 ? ts : format(new Date(ts), 'yyyy-MM-dd'));

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True when someone joining on `joinedDay` joined within a day of the house being created. */
export function isNewHouseJoin(houseCreatedAt: string, joinedDay: string): boolean {
  return joinedDay <= addDays(dayOf(houseCreatedAt), NEW_HOUSE_DAYS);
}

/**
 * Someone just joined. Expenses from before they joined are NOT split with
 * them automatically. But in a brand-new house (joined within a day of it
 * being set up) they were probably living there all along — so ask the rest
 * of the house, in one message, whether to add them to any older expense.
 *
 * Never throws: a failed check must not break joining a house.
 */
export async function checkOldBillsForNewMember(
  houseId: string,
  userId: string,
  name: string,
  today: string = todayISO(),
  /** When they joined (ISO time) — anything added before this is "older". */
  joinedAt: string = new Date().toISOString()
): Promise<void> {
  try {
    const { data: house, error: houseErr } = await supabase
      .from('houses')
      .select('created_at')
      .eq('id', houseId)
      .single();
    if (houseErr || !house?.created_at) return;
    if (!isNewHouseJoin(house.created_at as string, today)) return;

    const [billsRes, paymentsRes] = await Promise.all([
      supabase
        .from('bills')
        .select('id', { count: 'exact', head: true })
        .eq('house_id', houseId)
        .lt('created_at', joinedAt),
      supabase
        .from('household_payments')
        .select('id', { count: 'exact', head: true })
        .eq('house_id', houseId)
        .lt('created_at', joinedAt),
    ]);
    if (billsRes.error) throw billsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;
    const count = (billsRes.count ?? 0) + (paymentsRes.count ?? 0);
    if (count === 0) return;

    notifyHousemates({
      houseId,
      excludeUserId: userId,
      copyKey: 'new_member_old_bills',
      copyParams: { name, count },
      data: { screen: 'bills' },
      notificationType: 'bill_added',
    });
  } catch (err) {
    captureError(err, { context: 'new-member-old-bills', houseId, userId });
  }
}
