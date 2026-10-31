/**
 * QA — LoadingSpinner
 *
 * Mate hops while things load. It must at least mount without crashing and
 * expose an accessible "Loading" progressbar for screen readers; big loaders
 * add a funny line, small inline ones stay quiet.
 */

import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({ t: (key: string): string => key }),
}));

// The spinner drives its rotation with requestAnimationFrame (polyfilled as a
// timer in the RN preset). Fake timers keep that loop from firing setState
// outside act() during assertions, so the render stays a clean snapshot.
describe('LoadingSpinner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const motionAllowed = async (): Promise<void> => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  };

  it('renders an accessible loading indicator', () => {
    render(<LoadingSpinner />);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
  });

  it('honours a custom accessibility label', () => {
    render(<LoadingSpinner accessibilityLabel="Loading photos" />);
    expect(screen.getByLabelText('Loading photos')).toBeTruthy();
  });

  it('says something funny on a big loader', () => {
    render(<LoadingSpinner size={140} />);
    expect(screen.getByText(/^loading\.quip_/)).toBeTruthy();
  });

  it('stays quiet on a small inline loader', () => {
    render(<LoadingSpinner size={64} />);
    expect(screen.queryByText(/^loading\.quip_/)).toBeNull();
  });

  it('keeps each funny line up long enough to read', async () => {
    await motionAllowed();
    render(<LoadingSpinner size={140} />);
    // Let the reduce-motion setting load before timing anything.
    await act(async () => {
      await Promise.resolve();
    });
    const first = screen.getByText(/^loading\.quip_/).props.children;
    // The old pace swapped lines every 2.6s — far too fast to read.
    await act(async () => {
      jest.advanceTimersByTime(4500);
    });
    expect(screen.getByText(/^loading\.quip_/).props.children).toBe(first);
    // Past the 5s mark the old line fades out and a new one fades in.
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByText(/^loading\.quip_/).props.children).not.toBe(first);
  });

  it('shows a moving progress bar on a big loader', async () => {
    await motionAllowed();
    render(<LoadingSpinner size={140} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('loading-bar', { includeHiddenElements: true })).toBeTruthy();
  });

  it('has no progress bar on a small inline loader', async () => {
    await motionAllowed();
    render(<LoadingSpinner size={64} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('loading-bar', { includeHiddenElements: true })).toBeNull();
  });
});
