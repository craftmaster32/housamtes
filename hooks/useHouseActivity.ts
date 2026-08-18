import { useMemo } from 'react';
import { type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { type IoniconName } from '@/types/icons';
import { useBillsStore } from '@stores/billsStore';
import { useRecurringBillsStore, resolveBillIcon } from '@stores/recurringBillsStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useTasksStore } from '@stores/tasksStore';
import { useVotingStore } from '@stores/votingStore';
import { useParkingStore } from '@stores/parkingStore';
import { useAuthStore } from '@stores/authStore';

export type ActivityTone = 'primary' | 'success' | 'warning' | 'purple';

export interface ActivityEntry {
  id: string;
  createdAt: string;
  actorId: string;
  icon: IoniconName;
  tone: ActivityTone;
  /** i18n key for the action phrase, e.g. "added an expense". */
  actionKey: string;
  /** The item's own title/name, shown as a secondary line. */
  detail: string;
  route: Href;
}

/**
 * Aggregates recent house activity (new bills, groceries, notes, tasks, votes)
 * into one reverse-chronological feed for the dashboard notifications popup.
 */
export function useHouseActivity(limit = 30): ActivityEntry[] {
  const bills = useBillsStore((s) => s.bills);
  const recurringBills = useRecurringBillsStore((s) => s.bills);
  const payments = useRecurringBillsStore((s) => s.payments);
  const groceryItems = useGroceryStore((s) => s.items);
  const announcements = useAnnouncementsStore((s) => s.items);
  const tasks = useTasksStore((s) => s.tasks);
  const proposals = useVotingStore((s) => s.proposals);

  return useMemo(() => {
    const entries: ActivityEntry[] = [];

    for (const b of bills) {
      if (!b.createdAt) continue;
      entries.push({
        id: `bill:${b.id}`,
        createdAt: b.createdAt,
        actorId: b.paidBy,
        icon: 'receipt-outline',
        tone: 'primary',
        actionKey: 'activity.added_expense',
        detail: b.title,
        route: { pathname: '/(tabs)/bills/[id]', params: { id: b.id } },
      });
    }

    for (const rb of recurringBills) {
      if (!rb.createdAt) continue;
      entries.push({
        id: `rbill:${rb.id}`,
        createdAt: rb.createdAt,
        actorId: rb.assignedTo,
        icon: resolveBillIcon(rb.icon),
        tone: 'primary',
        actionKey: 'activity.added_recurring_bill',
        detail: rb.name,
        route: { pathname: '/(tabs)/bills', params: { openRecurring: '1' } },
      });
    }

    for (const p of payments) {
      if (!p.createdAt) continue;
      const bill = recurringBills.find((b) => b.id === p.billId);
      entries.push({
        id: `rpay:${p.id}`,
        createdAt: p.createdAt,
        actorId: bill?.assignedTo ?? '',
        icon: bill ? resolveBillIcon(bill.icon) : 'receipt-outline',
        tone: 'success',
        actionKey: 'activity.logged_payment',
        detail: bill?.name ?? '',
        route: { pathname: '/(tabs)/bills', params: { openRecurring: '1' } },
      });
    }

    for (const g of groceryItems) {
      if (g.isDraft || g.isPersonal || !g.createdAt) continue;
      entries.push({
        id: `groc:${g.id}`,
        createdAt: g.createdAt,
        actorId: g.addedBy,
        icon: 'cart-outline',
        tone: 'warning',
        actionKey: 'activity.added_grocery',
        detail: g.name,
        route: '/(tabs)/grocery',
      });
    }

    for (const a of announcements) {
      if (!a.createdAt) continue;
      entries.push({
        id: `ann:${a.id}`,
        createdAt: a.createdAt,
        actorId: a.author,
        icon: 'megaphone-outline',
        tone: 'purple',
        actionKey: 'activity.posted_note',
        detail: a.text,
        route: '/(tabs)/notes',
      });
    }

    for (const tk of tasks) {
      if (!tk.createdAt) continue;
      entries.push({
        id: `task:${tk.id}`,
        createdAt: tk.createdAt,
        actorId: tk.createdBy,
        icon: 'list-outline',
        tone: 'primary',
        actionKey: 'activity.added_task',
        detail: tk.title,
        route: '/(tabs)/tasks',
      });
    }

    for (const p of proposals) {
      if (!p.createdAt) continue;
      entries.push({
        id: `vote:${p.id}`,
        createdAt: p.createdAt,
        actorId: p.createdBy,
        icon: 'hand-left-outline',
        tone: 'success',
        actionKey: 'activity.started_vote',
        detail: p.title,
        route: '/(tabs)/voting',
      });
    }

    entries.sort((x, y) => (y.createdAt ?? '').localeCompare(x.createdAt ?? ''));
    return entries.slice(0, limit);
  }, [bills, recurringBills, payments, groceryItems, announcements, tasks, proposals, limit]);
}

function localeFor(lang: string): string {
  return lang === 'he' ? 'he-IL' : lang === 'es' ? 'es-ES' : 'en-GB';
}

/**
 * Items that need *this* user's action right now: open votes they haven't cast
 * and parking requests awaiting their vote. Unlike the activity feed these
 * persist until acted on, so the bell keeps its badge until the to-do is done.
 * IDs reuse the feed's `vote:<id>` form so the popup can de-dupe.
 */
export function useActionItems(): ActivityEntry[] {
  const { i18n } = useTranslation();
  const proposals = useVotingStore((s) => s.proposals);
  const reservations = useParkingStore((s) => s.reservations);
  const myId = useAuthStore((s) => s.profile?.id) ?? '';

  return useMemo(() => {
    if (!myId) return [];
    const items: ActivityEntry[] = [];

    for (const p of proposals) {
      if (!p.isOpen || p.createdBy === myId) continue;
      if (p.votes.some((v) => v.person === myId)) continue;
      items.push({
        id: `vote:${p.id}`,
        createdAt: p.createdAt ?? '',
        actorId: p.createdBy,
        icon: 'hand-left-outline',
        tone: 'success',
        actionKey: 'activity.needs_your_vote',
        detail: p.title,
        route: '/(tabs)/voting',
      });
    }

    for (const r of reservations) {
      if (r.status !== 'pending' || r.requestedBy === myId) continue;
      if (r.votes.some((v) => v.userId === myId)) continue;
      const when = r.date
        ? new Date(`${r.date}T00:00:00`).toLocaleDateString(localeFor(i18n.language), {
            day: 'numeric',
            month: 'short',
          })
        : '';
      items.push({
        id: `park:${r.id}`,
        createdAt: r.date ?? '',
        actorId: r.requestedBy,
        icon: 'car-outline',
        tone: 'warning',
        actionKey: 'activity.needs_parking_vote',
        detail: when,
        route: '/(tabs)/parking',
      });
    }

    return items;
  }, [proposals, reservations, myId, i18n.language]);
}
