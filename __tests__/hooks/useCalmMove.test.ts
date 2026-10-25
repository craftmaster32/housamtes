import { act, renderHook, type RenderHookResult } from '@testing-library/react-native';
import { useCalmMove, type CalmMove } from '@hooks/useCalmMove';
import { type GroceryItem } from '@stores/groceryStore';

const item = (id: string, isChecked = false): GroceryItem => ({
  id,
  name: id,
  quantity: '1',
  boughtCount: 0,
  addedBy: 'u1',
  isChecked,
  createdAt: '2026-10-20T10:00:00Z',
  isPersonal: false,
  isDraft: false,
});
const isDone = (i: GroceryItem): boolean => i.isChecked;

function setup(
  initial: GroceryItem[]
): RenderHookResult<CalmMove<GroceryItem>, { items: GroceryItem[] }> {
  return renderHook(({ items }) => useCalmMove(items, isDone), {
    initialProps: { items: initial },
  });
}

describe('useCalmMove', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows items on their side straight away when the trip opens', () => {
    const milk = item('milk');
    const eggs = item('eggs', true);
    const { result } = setup([milk, eggs]);
    expect(result.current.isShownDone(milk)).toBe(false);
    expect(result.current.isShownDone(eggs)).toBe(true);
  });

  it('keeps a ticked item in place, then folds it into the basket', () => {
    const { result, rerender } = setup([item('milk'), item('eggs')]);
    const ticked = item('milk', true);
    rerender({ items: [ticked, item('eggs')] });

    // Right after the tap nothing moves.
    expect(result.current.isShownDone(ticked)).toBe(false);
    expect(result.current.leavingIds.size).toBe(0);

    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(result.current.leavingIds.has('milk')).toBe(true);
    expect(result.current.isShownDone(ticked)).toBe(false);

    act(() => {
      jest.advanceTimersByTime(260);
    });
    expect(result.current.leavingIds.size).toBe(0);
    expect(result.current.arrivingIds.has('milk')).toBe(true);
    expect(result.current.isShownDone(ticked)).toBe(true);

    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current.arrivingIds.size).toBe(0);
  });

  it('moves several quick ticks together once the ticking pauses', () => {
    const { result, rerender } = setup([item('milk'), item('eggs')]);
    rerender({ items: [item('milk', true), item('eggs')] });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    rerender({ items: [item('milk', true), item('eggs', true)] });
    act(() => {
      jest.advanceTimersByTime(600);
    });
    // The second tick restarted the wait, so nothing has moved yet.
    expect(result.current.leavingIds.size).toBe(0);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect([...result.current.leavingIds].sort()).toEqual(['eggs', 'milk']);
  });

  it('does not move an item that was un-ticked in time', () => {
    const { result, rerender } = setup([item('milk')]);
    rerender({ items: [item('milk', true)] });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    rerender({ items: [item('milk')] });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.leavingIds.size).toBe(0);
    expect(result.current.arrivingIds.size).toBe(0);
    expect(result.current.isShownDone(item('milk'))).toBe(false);
  });
});
