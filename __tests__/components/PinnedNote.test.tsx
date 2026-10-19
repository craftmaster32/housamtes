/**
 * QA — home screen sticky note
 *
 * The newest house note shows on top; when there are older ones they pile up
 * behind it with a "+N more" hint, and tapping opens the notes page.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { PinnedNote } from '@components/dashboard/PinnedNote';
import { navigateToBase } from '@stores/navigationStore';

const mockNotes: { items: unknown[] } = { items: [] };

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@stores/navigationStore', () => ({ navigateToBase: jest.fn() }));
jest.mock('@stores/languageStore', () => ({
  useLanguageStore: (sel: (s: unknown) => unknown): unknown => sel({ language: 'en' }),
}));
jest.mock('@stores/announcementsStore', () => ({
  useAnnouncementsStore: (sel: (s: unknown) => unknown): unknown => sel(mockNotes),
}));
jest.mock('@hooks/useMemberName', () => ({
  useMemberName:
    (): ((id: string) => string) =>
    (id: string): string =>
      `Dana ${id}`,
}));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string, opts?: { count?: number }) => string } => ({
    t: (key: string, opts?: { count?: number }): string =>
      opts?.count !== undefined ? `${key}:${opts.count}` : key,
  }),
}));

const note = (id: string, text: string): Record<string, string> => ({
  id,
  author: 'u1',
  text,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('PinnedNote', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows nothing when there are no notes', () => {
    mockNotes.items = [];
    render(<PinnedNote />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the newest note on its own, without a "more" hint', () => {
    mockNotes.items = [note('n1', 'Bins out tonight')];
    render(<PinnedNote />);
    expect(screen.getByText('Bins out tonight')).toBeTruthy();
    expect(screen.queryByText(/dashboard\.more_notes/)).toBeNull();
  });

  it('piles older notes behind the newest with a "+N more" hint', () => {
    mockNotes.items = [note('n1', 'Newest'), note('n2', 'Older'), note('n3', 'Oldest')];
    render(<PinnedNote />);
    expect(screen.getByText('Newest')).toBeTruthy();
    expect(screen.queryByText('Older')).toBeNull();
    expect(screen.getByText('dashboard.more_notes:2')).toBeTruthy();
  });

  it('opens the notes page when tapped', () => {
    mockNotes.items = [note('n1', 'Newest'), note('n2', 'Older')];
    render(<PinnedNote />);
    fireEvent.press(screen.getByRole('button'));
    expect(navigateToBase).toHaveBeenCalledWith('/(tabs)/notes');
  });
});
