import { act, render, screen } from '@testing-library/react-native';
import { PenTick } from '@components/shared/PenTick';
import { RollingCount } from '@components/shared/RollingCount';

describe('PenTick', () => {
  it('shows nothing until the item is ticked', () => {
    const { toJSON } = render(<PenTick checked={false} size={25} color="#3B6FBF" />);
    expect(toJSON()).toBeNull();
  });

  it('shows an already-ticked item whole straight away', () => {
    const { toJSON } = render(<PenTick checked size={25} color="#3B6FBF" />);
    expect(toJSON()).not.toBeNull();
  });
});

describe('RollingCount', () => {
  it('ends on the new count after − / +', () => {
    jest.useFakeTimers();
    const { rerender } = render(<RollingCount text="2/12" value={2} />);
    rerender(<RollingCount text="3/12" value={3} />);
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText('3/12')).toBeTruthy();
    expect(screen.queryByText('2/12')).toBeNull();
    jest.useRealTimers();
  });
});
