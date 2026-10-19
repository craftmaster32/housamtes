/**
 * QA — home screen sticky note
 *
 * The newest house note shows on top. A lone note opens the notes page when
 * tapped. With several, they pile up: tapping tosses the top one aside to show
 * the next, after the last one the first comes back round, and "See all" opens
 * the notes page.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { PinnedNote } from '@components/dashboard/PinnedNote';
import { navigateToBase } from '@stores/navigationStore';

const mockNotes: { items: unknown[] } = { items: [] };

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@stores/navigationStore', () => ({ navigateToBase: jest.fn() }));
jest.mock('@hooks/useReduceMotion', () => ({ useReduceMotion: (): boolean => true }));
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
  useTranslation: (): { t: (key: string, opts?: { n?: number; count?: number }) => string } => ({
    t: (key: string, opts?: { n?: number; count?: number }): string =>
      opts?.count !== undefined ? `${key}:${opts.n}/${opts.count}` : key,
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

  it('shows a lone note without dots or a "See all" link, and opens notes on tap', () => {
    mockNotes.items = [note('n1', 'Bins out tonight')];
    render(<PinnedNote />);
    expect(screen.getByText('Bins out tonight')).toBeTruthy();
    expect(screen.queryByText('dashboard.see_all')).toBeNull();
    fireEvent.press(screen.getByRole('button'));
    expect(navigateToBase).toHaveBeenCalledWith('/(tabs)/notes');
  });

  it('shows the newest of several notes on top', () => {
    mockNotes.items = [note('n1', 'Newest'), note('n2', 'Older'), note('n3', 'Oldest')];
    render(<PinnedNote />);
    expect(screen.getByText('Newest')).toBeTruthy();
    expect(screen.queryByText('Older')).toBeNull();
    expect(screen.getByLabelText(/^dashboard\.note_position:1\/3/)).toBeTruthy();
  });

  it('tapping tosses the top note aside and loops back to the first', () => {
    mockNotes.items = [note('n1', 'Newest'), note('n2', 'Older'), note('n3', 'Oldest')];
    render(<PinnedNote />);
    const top = (): ReturnType<typeof screen.getByLabelText> =>
      screen.getByLabelText(/^dashboard\.note_position/);
    fireEvent.press(top());
    expect(screen.getByText('Older')).toBeTruthy();
    fireEvent.press(top());
    expect(screen.getByText('Oldest')).toBeTruthy();
    fireEvent.press(top());
    expect(screen.getByText('Newest')).toBeTruthy();
    expect(navigateToBase).not.toHaveBeenCalled();
  });

  it('"See all" opens the notes page', () => {
    mockNotes.items = [note('n1', 'Newest'), note('n2', 'Older')];
    render(<PinnedNote />);
    fireEvent.press(screen.getByText('dashboard.see_all'));
    expect(navigateToBase).toHaveBeenCalledWith('/(tabs)/notes');
  });
});
