import {
  categoryRows,
  fmtFull,
  fmtShort,
  fmtWhole,
  pctChange,
} from '@components/spending/spendingFormat';
import type { CategorySpend, MonthSpend } from '@stores/spendingStore';

const cat = (name: string, amount: number): CategorySpend => ({
  name,
  icon: 'cube',
  color: '#888888',
  amount,
  isHouse: false,
});

const month = (key: string, house: CategorySpend[], mine: CategorySpend[]): MonthSpend => ({
  month: key,
  label: key,
  total: mine.reduce((s, c) => s + c.amount, 0),
  houseTotal: house.reduce((s, c) => s + c.amount, 0),
  categories: mine,
  houseCategories: house,
  billsByCategory: {
    Rent: [{ id: 'b1', title: 'October rent', amount: 6900, date: '2026-10-01', type: 'bill' }],
  },
});

describe('spendingFormat', () => {
  it('formats amounts in full and short', () => {
    expect(fmtFull(12.5, '£')).toBe('£12.50');
    expect(fmtShort(980, '£')).toBe('£980');
    expect(fmtShort(1250, '£')).toBe('£1.3k');
  });

  it('writes whole amounts with thousands commas', () => {
    expect(fmtWhole(8032.8, '₪')).toBe('₪8,033');
    expect(fmtWhole(225, '₪')).toBe('₪225');
  });

  it('gives the change from last month, or nothing when last month was zero', () => {
    expect(pctChange(120, 100)).toBe(20);
    expect(pctChange(80, 100)).toBe(-20);
    expect(pctChange(50, 0)).toBeNull();
  });

  describe('categoryRows', () => {
    const oct = month(
      '2026-10',
      [cat('Electricity', 225), cat('Rent', 6900), cat('Groceries', 286), cat('Water', 0)],
      [cat('Electricity', 75), cat('Rent', 2300)]
    );
    const sep = month('2026-09', [cat('Electricity', 225)], [cat('Electricity', 75)]);

    it('lists the house view biggest first, with your share and last month', () => {
      const rows = categoryRows(oct, sep, 'house');
      expect(rows.map((r) => r.cat.name)).toEqual(['Rent', 'Groceries', 'Electricity']);
      expect(rows[0].myAmount).toBe(2300);
      expect(rows[0].drillDownItems).toHaveLength(1);
      expect(rows[2].prevHouseAmount).toBe(225);
      expect(rows[0].sectionTotal).toBe(7411);
    });

    it('lists only your own spending in the personal view', () => {
      const rows = categoryRows(oct, sep, 'personal');
      expect(rows.map((r) => r.cat.name)).toEqual(['Rent', 'Electricity']);
      expect(rows[1].prevHouseAmount).toBe(75);
    });

    it('is empty when there is no month', () => {
      expect(categoryRows(undefined, undefined, 'house')).toEqual([]);
    });
  });
});
