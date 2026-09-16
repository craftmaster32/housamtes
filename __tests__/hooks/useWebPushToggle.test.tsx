/**
 * QA — useWebPushToggle
 *
 * Locks in the fix for "toggle says On but no notifications arrive" on Safari:
 * the initial lookup must reconcile against the server row via
 * syncWebPushSubscription (which repairs a stale subscription and reports real
 * deliverability), not just read the lingering browser subscription. An
 * indeterminate (null) result must leave the toggle in its default off state
 * rather than flipping it on.
 */

import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useWebPushToggle } from '@hooks/useWebPushToggle';

const mockSync = jest.fn();
const mockHasActive = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (k: string) => string } => ({ t: (k: string): string => k }),
}));

jest.mock('@lib/alert', () => ({ Alert: { alert: jest.fn() } }));

jest.mock('@lib/webPush', () => ({
  enableWebPush: jest.fn(),
  getWebPushStatus: (): string => 'granted',
  hasActiveWebPushSubscription: (...a: unknown[]): unknown => mockHasActive(...a),
  syncWebPushSubscription: (...a: unknown[]): unknown => mockSync(...a),
  unregisterWebPush: jest.fn(),
}));

let mockAuthState: { user: { id: string } | null; houseId: string | null };

jest.mock('@stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof mockAuthState) => unknown): unknown =>
    selector(mockAuthState),
}));

describe('useWebPushToggle', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
    mockSync.mockReset();
    mockHasActive.mockReset();
    mockAuthState = { user: { id: 'u1' }, houseId: 'h1' };
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('reconciles against the server row and turns on when deliverable', async () => {
    mockSync.mockResolvedValue(true);

    const { result } = renderHook(() => useWebPushToggle());

    await waitFor(() => expect(result.current.webPushOn).toBe(true));
    expect(mockSync).toHaveBeenCalledWith('u1', 'h1');
    // The server-reconciling path replaces the browser-only check.
    expect(mockHasActive).not.toHaveBeenCalled();
  });

  it('shows off when the server row is missing (stale Safari subscription)', async () => {
    mockSync.mockResolvedValue(false);

    const { result } = renderHook(() => useWebPushToggle());

    await waitFor(() => expect(mockSync).toHaveBeenCalled());
    expect(result.current.webPushOn).toBe(false);
  });

  it('leaves the toggle untouched when the lookup is indeterminate', async () => {
    mockSync.mockResolvedValue(null);

    const { result } = renderHook(() => useWebPushToggle());

    await waitFor(() => expect(mockSync).toHaveBeenCalled());
    expect(result.current.webPushOn).toBe(false);
  });

  it('falls back to the browser-only check when there is no house yet', async () => {
    mockAuthState = { user: { id: 'u1' }, houseId: null };
    mockHasActive.mockResolvedValue(true);

    const { result } = renderHook(() => useWebPushToggle());

    await waitFor(() => expect(result.current.webPushOn).toBe(true));
    expect(mockHasActive).toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
  });
});
