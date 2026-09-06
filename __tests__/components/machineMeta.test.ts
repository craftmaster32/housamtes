/**
 * Machine timer display helpers.
 *
 * These back the live countdown shown on the machines page and the dashboard
 * appliance card, so they're the thing that makes the clock "run down" as a
 * cycle progresses. Locking their output keeps that ticking readout correct.
 */
import { formatDuration, formatRemaining } from '@components/machines/meta';

describe('formatDuration', () => {
  it('shows minutes only under an hour', () => {
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(0)).toBe('0m');
  });

  it('shows whole hours without a stray 0m', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('combines hours and minutes', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });
});

describe('formatRemaining', () => {
  it('shows hours and minutes while over an hour is left', () => {
    expect(formatRemaining(90 * 60 * 1000)).toBe('1h 30m');
  });

  it('drops to minutes and seconds under an hour', () => {
    expect(formatRemaining((23 * 60 + 5) * 1000)).toBe('23m 5s');
  });

  it('counts down the final seconds', () => {
    expect(formatRemaining(9 * 1000)).toBe('9s');
  });

  it('never goes negative once the cycle is done', () => {
    expect(formatRemaining(0)).toBe('0s');
    expect(formatRemaining(-5000)).toBe('0s');
  });
});
