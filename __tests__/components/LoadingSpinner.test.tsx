/**
 * QA — LoadingSpinner
 *
 * Mate hops while things load. It must at least mount without crashing and
 * expose an accessible "Loading" progressbar for screen readers; big loaders
 * add a funny line, small inline ones stay quiet.
 */

import { render, screen } from '@testing-library/react-native';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({ t: (key: string): string => key }),
}));

// The spinner drives its rotation with requestAnimationFrame (polyfilled as a
// timer in the RN preset). Fake timers keep that loop from firing setState
// outside act() during assertions, so the render stays a clean snapshot.
describe('LoadingSpinner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

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
});
