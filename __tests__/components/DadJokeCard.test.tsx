/**
 * QA — the home screen joke, told by Nesti
 *
 * The redesign moved the daily joke into a speech bubble from Nesti. The
 * behaviour must stay the same: the punchline is hidden until you tap to reveal
 * it, and "another one" then swaps in a fresh joke with the punchline hidden.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { DadJokeCard } from '@components/shared/DadJokeCard';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
// Reanimated's native half isn't available under Jest; the fades are cosmetic,
// so render Animated.View as a plain View.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  interface MockFade {
    duration: () => MockFade;
  }
  const fade: MockFade = { duration: (): MockFade => fade };
  return { __esModule: true, default: { View }, FadeIn: fade };
});
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));
jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string, opts?: { defaultValue?: string }) => string } => ({
    t: (key: string, opts?: { defaultValue?: string }): string => opts?.defaultValue ?? key,
  }),
}));
jest.mock('@constants/dadJokes', () => {
  interface MockJoke {
    setup: string;
    punchline: string;
    category: string;
  }
  const daily: MockJoke = {
    setup: 'Why did the scarecrow win?',
    punchline: 'Outstanding in his field.',
    category: 'classic',
  };
  const next: MockJoke = {
    setup: 'What do you call a fake noodle?',
    punchline: 'An impasta.',
    category: 'food',
  };
  return { getDailyJoke: (): MockJoke => daily, getRandomJoke: (): MockJoke => next };
});

describe('DadJokeCard', () => {
  it("shows Nesti's heading, the setup, and hides the punchline", () => {
    render(<DadJokeCard animateEntrance={false} />);
    expect(screen.getByText('dashboard.nesti_joke_title')).toBeTruthy();
    expect(screen.getByTestId('nesti-wink')).toBeTruthy();
    expect(screen.getByText('Why did the scarecrow win?')).toBeTruthy();
    expect(screen.queryByText('Outstanding in his field.')).toBeNull();
  });

  it('reveals the punchline on tap', () => {
    render(<DadJokeCard animateEntrance={false} />);
    fireEvent.press(screen.getByLabelText('games.tap_to_reveal'));
    expect(screen.getByText('Outstanding in his field.')).toBeTruthy();
  });

  it('swaps in another joke with its punchline hidden again', () => {
    render(<DadJokeCard animateEntrance={false} />);
    fireEvent.press(screen.getByLabelText('games.tap_to_reveal'));
    fireEvent.press(screen.getByLabelText('games.another_one'));
    expect(screen.getByText('What do you call a fake noodle?')).toBeTruthy();
    expect(screen.queryByText('An impasta.')).toBeNull();
    expect(screen.getByLabelText('games.tap_to_reveal')).toBeTruthy();
  });
});
