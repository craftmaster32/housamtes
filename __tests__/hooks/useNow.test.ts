import { act, renderHook } from '@testing-library/react-native';
import { useNow } from '@hooks/useNow';

describe('useNow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-11T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves forward once a minute so age labels stay current', () => {
    const { result } = renderHook(() => useNow());
    const start = result.current;

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(result.current - start).toBe(60_000);
  });

  it('stops ticking after the screen unmounts', () => {
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
