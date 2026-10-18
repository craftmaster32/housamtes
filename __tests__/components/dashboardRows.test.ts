/**
 * QA — "Around the house" row order
 *
 * The old carousel let you pin one card to the left. In the list it now sits on
 * top. Everything else keeps the order you chose.
 */

import { orderDashboardRows } from '@components/dashboard/DashboardCarousel';

jest.mock('@lib/supabase', () => ({ supabase: {} }));

describe('orderDashboardRows', () => {
  it('keeps the chosen order when nothing is pinned', () => {
    expect(orderDashboardRows(['parking', 'groceries', 'chores'], null)).toEqual([
      'parking',
      'groceries',
      'chores',
    ]);
  });

  it('moves the pinned row to the top', () => {
    expect(orderDashboardRows(['parking', 'groceries', 'chores'], 'chores')).toEqual([
      'chores',
      'parking',
      'groceries',
    ]);
  });

  it('ignores a pin on a row that is switched off', () => {
    expect(orderDashboardRows(['parking', 'groceries'], 'votes')).toEqual(['parking', 'groceries']);
  });

  it('returns nothing when every row is switched off', () => {
    expect(orderDashboardRows([], 'parking')).toEqual([]);
  });
});
