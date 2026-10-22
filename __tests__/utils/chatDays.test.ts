import { buildListItems, dayKey, formatDateLabel } from '@utils/chatDays';
import type { ChatMessage } from '@stores/chatStore';

jest.mock('@lib/supabase', () => ({ supabase: {} }));

const msg = (id: string, createdAt: Date): ChatMessage =>
  ({ id, author: 'u', text: id, createdAt: createdAt.toISOString() }) as ChatMessage;

describe('chatDays', () => {
  const now = new Date(2026, 9, 22, 12, 0); // Thu 22 Oct 2026, noon

  it('groups by the local calendar day', () => {
    expect(dayKey(new Date(2026, 9, 22, 0, 30).toISOString())).toBe('2026-10-22');
    expect(dayKey(new Date(2026, 9, 22, 23, 30).toISOString())).toBe('2026-10-22');
  });

  it('labels today, yesterday and older days', () => {
    expect(formatDateLabel(new Date(2026, 9, 22, 8).toISOString(), now)).toBe('Today');
    expect(formatDateLabel(new Date(2026, 9, 21, 23).toISOString(), now)).toBe('Yesterday');
    expect(formatDateLabel(new Date(2026, 9, 18, 9).toISOString(), now)).toMatch(/18/);
  });

  it('puts one heading before each new day and keeps messages in order', () => {
    const items = buildListItems(
      [
        msg('a', new Date(2026, 9, 21, 21, 14)),
        msg('b', new Date(2026, 9, 21, 21, 20)),
        msg('c', new Date(2026, 9, 22, 8, 2)),
      ],
      now
    );
    expect(items.map((i) => (i.kind === 'separator' ? `# ${i.label}` : i.msg.id))).toEqual([
      '# Yesterday',
      'a',
      'b',
      '# Today',
      'c',
    ]);
  });

  it('shows nothing for no messages', () => {
    expect(buildListItems([], now)).toEqual([]);
  });
});
