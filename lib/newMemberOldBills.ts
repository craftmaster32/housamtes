import { supabase } from '@lib/supabase';
import { captureError } from '@lib/errorTracking';
import { notifyHousemates } from '@lib/notifyHousemates';
import { format } from 'date-fns';

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
  name: string
): Promise<void> {
  try {
    // When they joined, as the database recorded it (not the phone's clock,
    // which can be off, or "now", which may already be past midnight).
    const { data: member, error: memberErr } = await supabase
      .from('house_members')
      .select('joined_at')
      .eq('house_id', houseId)
      .eq('user_id', userId)
      .single();
    if (memberErr || !member?.joined_at) return;
    const joinedAt = member.joined_at as string;

    const { data: house, error: houseErr } = await supabase
      .from('houses')
      .select('created_at')
      .eq('id', houseId)
      .single();
    if (houseErr || !house?.created_at) return;
    // The day they joined (in local time) decides whether the house was new.
    if (!isNewHouseJoin(house.created_at as string, dayOf(joinedAt))) return;

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
