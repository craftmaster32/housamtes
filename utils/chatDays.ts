import type { ChatMessage } from '@stores/chatStore';

/** "08:12" in 24-hour time, in the device's locale. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Local YYYY-MM-DD, so messages group by the housemates' own calendar day. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Today", "Yesterday" or "Monday 20 October". */
export function formatDateLabel(iso: string, now: Date = new Date()): string {
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day.getTime() === today.getTime()) return 'Today';
  if (day.getTime() === yesterday.getTime()) return 'Yesterday';
  return day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

export type ChatListItem =
  | { kind: 'separator'; id: string; label: string }
  | { kind: 'message'; msg: ChatMessage };

/** Messages (oldest first) with a day heading before each new day. */
export function buildListItems(messages: ChatMessage[], now: Date = new Date()): ChatListItem[] {
  const items: ChatListItem[] = [];
  let lastKey = '';
  for (const msg of messages) {
    const key = dayKey(msg.createdAt);
    if (key !== lastKey) {
      items.push({
        kind: 'separator',
        id: `sep-${key}`,
        label: formatDateLabel(msg.createdAt, now),
      });
      lastKey = key;
    }
    items.push({ kind: 'message', msg });
  }
  return items;
}
