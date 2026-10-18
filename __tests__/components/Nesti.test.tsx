/**
 * QA — Nesti, the house character
 *
 * Nesti is decorative by default (it sits next to text that already says what's
 * going on), but must expose a label to screen readers when given one, and every
 * mood must render without crashing in both themes.
 */

import { render, screen } from '@testing-library/react-native';
import { Nesti, type NestiMood } from '@components/shared/Nesti';
import { useSettingsStore } from '@stores/settingsStore';

jest.mock('@lib/supabase', () => ({ supabase: {} }));

const MOODS: NestiMood[] = ['hello', 'wink', 'sleepy', 'cheer'];

describe('Nesti', () => {
  afterEach(() => {
    useSettingsStore.setState({ themeMode: 'light' } as never);
  });

  it.each(MOODS)('renders the %s mood', (mood) => {
    render(<Nesti mood={mood} />);
    expect(screen.getByTestId(`nesti-${mood}`)).toBeTruthy();
  });

  it('renders every mood in dark mode too', () => {
    useSettingsStore.setState({ themeMode: 'dark' } as never);
    for (const mood of MOODS) {
      const { unmount } = render(<Nesti mood={mood} />);
      expect(screen.getByTestId(`nesti-${mood}`)).toBeTruthy();
      unmount();
    }
  });

  it('is announced to screen readers when it has a label', () => {
    render(<Nesti mood="cheer" accessibilityLabel="Nesti cheering" />);
    expect(screen.getByLabelText('Nesti cheering')).toBeTruthy();
  });

  it('stays out of the way of screen readers when it has no label', () => {
    render(<Nesti mood="hello" />);
    expect(screen.getByTestId('nesti-hello').props.accessible).toBe(false);
  });
});
