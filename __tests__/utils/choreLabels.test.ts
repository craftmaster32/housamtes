import { freqLabel, localizedWeekDay, ordinal } from '@utils/choreLabels';
import type { Chore } from '@stores/choresStore';

jest.mock('@lib/supabase', () => ({ supabase: {} }));

const chore = (over: Partial<Chore>): Chore =>
  ({
    id: 'c',
    name: 'Bins',
    claimedBy: null,
    recurrence: 'once',
    recurrenceDay: null,
    isComplete: false,
    ...over,
  }) as Chore;
const t = (key: string): string => key;

describe('choreLabels', () => {
  it('writes ordinals', () => {
    expect(['1', '2', '3', '4', '11', '12', '21', '22', '31'].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '21st',
      '22nd',
      '31st',
    ]);
  });

  it('names a stored weekday in the given language', () => {
    expect(localizedWeekDay('Thu', 'en-US')).toBe('Thursday');
    expect(localizedWeekDay('Nope', 'en-US')).toBe('Nope');
  });

  it('describes how often a chore repeats', () => {
    expect(freqLabel(chore({}), t, 'en-US')).toBeNull();
    expect(freqLabel(chore({ recurrence: 'weekly', recurrenceDay: 'Mon' }), t, 'en-US')).toBe(
      'Every Monday'
    );
    expect(freqLabel(chore({ recurrence: 'weekly' }), t, 'en-US')).toBe('chores.weekly');
    expect(freqLabel(chore({ recurrence: 'monthly', recurrenceDay: '1' }), t, 'en-US')).toBe(
      '1st chores.of_month'
    );
  });
});
