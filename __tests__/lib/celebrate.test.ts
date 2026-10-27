import { celebrate, getCelebration, finishCelebration, subscribeCelebration } from '@lib/celebrate';

describe("Mate's celebrations", () => {
  it('shows the latest celebration and clears it once Mate has gone', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeCelebration(listener);
    celebrate('bill');
    celebrate('vote');
    const shown = getCelebration();
    expect(shown?.kind).toBe('vote');
    expect(listener).toHaveBeenCalledTimes(2);

    // Finishing an older one doesn't hide the newer one.
    finishCelebration((shown?.id ?? 0) - 1);
    expect(getCelebration()?.kind).toBe('vote');

    finishCelebration(shown?.id ?? 0);
    expect(getCelebration()).toBeNull();
    unsubscribe();
  });
});
