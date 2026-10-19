/**
 * QA — the home screen joke, told by Mate
 *
 * The redesign moved the daily joke into a speech bubble from Mate, the little
 * house. The behaviour must stay the same: the punchline is hidden until you tap
 * to reveal it, and "another one" then swaps in a fresh joke, punchline hidden.
 */

import { render, screen, fireEvent } from '@testing-library/react-native';
import { DadJokeCard } from '@components/shared/DadJokeCard';

jest.mock('@lib/supabase', () => ({ supabase: {} }));
jest.mock('@lib/i18n', () => ({ isRTL: (): boolean => false }));
jest.mock('@stores/languageStore', () => ({
  useLanguageStore: (sel: (s: unknown) => unknown): unknown => sel({ language: 'en' }),
}));
// Reanimated's native half isn't available under Jest; the fades and Mate's
// wave are cosmetic, so render Animated.View as a plain View.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  interface MockFade {
    duration: () => MockFade;
  }
  const fade: MockFade = { duration: (): MockFade => fade };
  return {
    __esModule: true,
    default: { View },
    FadeIn: fade,
    Easing: { inOut: (): null => null, out: (): null => null, quad: null },
    useSharedValue: (v: number): { value: number } => ({ value: v }),
    useAnimatedStyle: (): Record<string, never> => ({}),
    withDelay: (): number => 0,
    withSequence: (): number => 0,
    withTiming: (): number => 0,
  };
});
jest.mock('react-native-svg', () => {
  const Empty = (): null => null;
  return {
    __esModule: true,
    default: Empty,
    Circle: Empty,
    Ellipse: Empty,
    Path: Empty,
    Rect: Empty,
  };
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
  it('shows the heading, Mate, the setup, and hides the punchline', () => {
    render(<DadJokeCard animateEntrance={false} />);
    expect(screen.getByText('games.dad_joke_of_the_day')).toBeTruthy();
    expect(screen.getByTestId('mate')).toBeTruthy();
    expect(screen.getByText('Why did the scarecrow win?')).toBeTruthy();
    expect(screen.queryByText('Outstanding in his field.')).toBeNull();
  });

  it('reveals the punchline on tap', () => {
    render(<DadJokeCard animateEntrance={false} />);
    fireEvent.press(screen.getByLabelText('games.tap_to_reveal'));
    expect(screen.getByText('Outstanding in his field.')).toBeTruthy();
  });

  it('"another one" swaps in a new joke with the punchline hidden again', () => {
    render(<DadJokeCard animateEntrance={false} />);
    fireEvent.press(screen.getByLabelText('games.tap_to_reveal'));
    fireEvent.press(screen.getByLabelText('games.another_one'));
    expect(screen.getByText('What do you call a fake noodle?')).toBeTruthy();
    expect(screen.queryByText('An impasta.')).toBeNull();
  });
});
