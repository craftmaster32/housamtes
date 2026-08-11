/**
 * QA — LoadingSpinner
 *
 * The house-ring loader is purely visual, but it must at least mount without
 * crashing and expose an accessible "Loading" progressbar for screen readers.
 */

import { render, screen } from '@testing-library/react-native';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';

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
});
