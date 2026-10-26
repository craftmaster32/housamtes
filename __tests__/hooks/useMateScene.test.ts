import { renderHook, act } from '@testing-library/react-native';
import { useMateScene } from '../../hooks/useMateScene';

// Capture the page's "came into view" callback so the test can fire it.
let onFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void): void => {
    onFocus = cb;
  },
}));

const SPOTS = ['rope', 'sit', 'footer'] as const;

afterEach(() => {
  jest.restoreAllMocks();
  onFocus = null;
});

describe('useMateScene', () => {
  it('picks again every time the page comes back into view', () => {
    const random = jest.spyOn(Math, 'random');
    // First visit: the coin toss fails, so Mate stays away.
    random.mockReturnValueOnce(0.95);
    const { result } = renderHook(() => useMateScene(SPOTS));
    expect(result.current).toBeNull();

    // Next visit: he shows, in the second spot.
    random.mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
    act(() => onFocus?.());
    expect(result.current).toBe('sit');
  });

  it('stays hidden while the page shows its empty-state Mate', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const { result } = renderHook(() => useMateScene(SPOTS, false));
    expect(result.current).toBeNull();
  });
});
