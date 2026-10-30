import { defaultRepeatDay, localizedWeekDay, ordinal, repeatLabel } from '@utils/taskRepeat';

jest.mock('@lib/supabase', () => ({ supabase: {} }));

const t = (key: string, opts?: Record<string, unknown>): string =>
  opts ? `${key} ${JSON.stringify(opts)}` : key;

describe('taskRepeat', () => {
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

  it('starts a new repeating task on today', () => {
    const thu22 = new Date(2026, 9, 22);
    expect(defaultRepeatDay('weekly', thu22)).toBe('Thu');
    expect(defaultRepeatDay('monthly', thu22)).toBe('22');
    expect(defaultRepeatDay('once', thu22)).toBeNull();
  });

  it('describes how often a task repeats, through the translations', () => {
    expect(repeatLabel({ recurrence: 'once', recurrenceDay: null }, t, 'en-US')).toBeNull();
    expect(repeatLabel({ recurrence: 'weekly', recurrenceDay: 'Mon' }, t, 'en-US')).toBe(
      'tasks.every_day {"day":"Monday"}'
    );
    expect(repeatLabel({ recurrence: 'weekly', recurrenceDay: null }, t, 'en-US')).toBe(
      'tasks.weekly'
    );
    expect(repeatLabel({ recurrence: 'monthly', recurrenceDay: '1' }, t, 'en-US')).toBe(
      '1st tasks.of_month'
    );
  });
});
