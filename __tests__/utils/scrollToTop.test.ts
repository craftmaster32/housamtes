import { onScrollToTop, requestScrollToTop } from '../../utils/scrollToTop';

describe('scrollToTop signal', () => {
  it('tells every listening page which page was tapped', () => {
    const a = jest.fn();
    const b = jest.fn();
    const offA = onScrollToTop(a);
    const offB = onScrollToTop(b);

    requestScrollToTop('bills/index');

    expect(a).toHaveBeenCalledWith('bills/index');
    expect(b).toHaveBeenCalledWith('bills/index');
    offA();
    offB();
  });

  it('stops telling a page once it has gone', () => {
    const listener = jest.fn();
    const off = onScrollToTop(listener);
    off();

    requestScrollToTop('parking/index');

    expect(listener).not.toHaveBeenCalled();
  });
});
