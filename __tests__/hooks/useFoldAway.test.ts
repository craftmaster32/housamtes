import { act, renderHook } from '@testing-library/react-native';
import { useFoldAway } from '@hooks/useFoldAway';

describe('useFoldAway', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('folds the rows away first and only then removes them', async () => {
    const remove = jest.fn(() => Promise.resolve());
    const { result } = renderHook(() => useFoldAway());

    act(() => result.current.foldAway(['milk', 'eggs'], remove));
    expect([...result.current.foldingIds].sort()).toEqual(['eggs', 'milk']);
    expect(remove).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(result.current.foldingIds.size).toBe(0);
  });

  it('lets the rows unfold again when removing fails', async () => {
    const remove = jest.fn(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useFoldAway());

    act(() => result.current.foldAway(['milk'], remove));
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current.foldingIds.size).toBe(0);
  });
});
