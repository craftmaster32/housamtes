import { act, renderHook, type RenderHookResult, waitFor } from '@testing-library/react-native';
import { useStaleNudge, type StaleNudge } from '@hooks/useStaleNudge';
import { type GroceryItem } from '@stores/groceryStore';

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

const NOW = new Date('2026-10-25T12:00:00Z').getTime();

const item = (id: string, daysOld: number, isChecked = false): GroceryItem => ({
  id,
  name: id,
  quantity: '1',
  boughtCount: 0,
  addedBy: 'u1',
  isChecked,
  createdAt: new Date(NOW - daysOld * 86_400_000).toISOString(),
  isPersonal: false,
  isDraft: false,
});

function setup(initial: GroceryItem[]): RenderHookResult<StaleNudge, { items: GroceryItem[] }> {
  return renderHook(({ items }) => useStaleNudge(items, NOW, jest.fn()), {
    initialProps: { items: initial },
  });
}

describe('useStaleNudge', () => {
  it('sits under the oldest waiting item', async () => {
    const { result } = setup([item('milk', 1), item('coriander', 9), item('rice', 5)]);
    await waitFor(() => expect(result.current.nudge?.id).toBe('coriander'));
    expect(result.current.isOpen).toBe(true);
  });

  it('folds away when its item is ticked, without jumping to another row', async () => {
    const { result, rerender } = setup([item('coriander', 9), item('rice', 5)]);
    await waitFor(() => expect(result.current.nudge?.id).toBe('coriander'));

    rerender({ items: [item('coriander', 9, true), item('rice', 5)] });
    expect(result.current.nudge?.id).toBe('coriander');
    expect(result.current.isOpen).toBe(false);

    // Even after it has folded, it doesn't pop up under the next item.
    act(() => result.current.handleClosed());
    expect(result.current.nudge?.id).toBe('coriander');

    // Un-ticking brings it back in the same place.
    rerender({ items: [item('coriander', 9), item('rice', 5)] });
    expect(result.current.isOpen).toBe(true);
  });

  it('hands over to the next waiting item once kept and folded', async () => {
    const { result } = setup([item('coriander', 9), item('rice', 5)]);
    await waitFor(() => expect(result.current.nudge?.id).toBe('coriander'));

    act(() => result.current.handleKeep());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.nudge?.id).toBe('coriander');

    act(() => result.current.handleClosed());
    await waitFor(() => expect(result.current.nudge?.id).toBe('rice'));
    expect(result.current.appear).toBe(true);
    expect(result.current.isOpen).toBe(true);
  });
});
