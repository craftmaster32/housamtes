/**
 * QA — withFeatureGuard
 *
 * The guard must not merely hide a denied feature after the fact: the wrapped
 * screen body — and therefore its data-loading effects — must never mount while
 * access is denied. These tests lock that in by asserting the inner component's
 * render function is not even called when the guard reports "denied".
 */

import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

// Control the guard's verdict directly so this test needs no store/router setup.
const mockGuard = jest.fn();
jest.mock('@hooks/useFeatureGuard', () => ({
  useFeatureGuard: (key: string): boolean => mockGuard(key),
}));

import { withFeatureGuard } from '@components/shared/withFeatureGuard';

describe('withFeatureGuard', () => {
  beforeEach(() => mockGuard.mockReset());

  it('mounts the screen body when access is allowed', () => {
    const body = jest.fn(() => <Text>Bills content</Text>);
    mockGuard.mockReturnValue(true);
    const Guarded = withFeatureGuard('bills', body);

    render(<Guarded />);

    expect(mockGuard).toHaveBeenCalledWith('bills');
    expect(body).toHaveBeenCalled();
    expect(screen.getByText('Bills content')).toBeTruthy();
  });

  it('renders nothing and never mounts the body when access is denied', () => {
    const body = jest.fn(() => <Text>Bills content</Text>);
    mockGuard.mockReturnValue(false);
    const Guarded = withFeatureGuard('bills', body);

    render(<Guarded />);

    // The body's effects (data loads, starting a run) can only fire if it
    // mounts — so proving it never rendered proves they never ran.
    expect(body).not.toHaveBeenCalled();
    expect(screen.queryByText('Bills content')).toBeNull();
  });
});
