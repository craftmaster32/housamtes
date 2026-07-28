import { useMemo } from 'react';
import { type Href } from 'expo-router';
import { type IoniconName } from '@/types/icons';
import { useBillsStore } from '@stores/billsStore';
import { useGroceryStore } from '@stores/groceryStore';
import { useAnnouncementsStore } from '@stores/announcementsStore';
import { useTasksStore } from '@stores/tasksStore';
import { useVotingStore } from '@stores/votingStore';

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
  }, [bills, groceryItems, announcements, tasks, proposals, limit]);
}
