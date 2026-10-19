import { guessExpenseCategory, defaultExpenseCategory } from '@utils/expenseCategory';

const HOUSE = [
  'Rent',
  'Electricity',
  'Water',
  'Internet',
  'Groceries',
  'Outside Food',
  'Transport',
  'Entertainment',
  'Health',
  'Other',
];

describe('defaultExpenseCategory', () => {
  it('starts every new expense on Other', () => {
    expect(defaultExpenseCategory(HOUSE)).toBe('Other');
  });
  it('falls back to the first category when the house has no Other', () => {
    expect(defaultExpenseCategory(['Rent', 'Food'])).toBe('Rent');
    expect(defaultExpenseCategory([])).toBe('');
  });
});

describe('guessExpenseCategory', () => {
  it.each([
    ['Shufersal weekly shop', 'Groceries'],
    ['רמי לוי', 'Groceries'],
    ['Milk and eggs', 'Groceries'],
    ['Friday pizza', 'Outside Food'],
    ['Taxi from airport', 'Transport'],
    ['מונית לשדה', 'Transport'],
    ['Cinema tickets', 'Entertainment'],
    ['Pharmacy', 'Health'],
    ['Electricity bill', 'Electricity'],
    ['חשבון חשמל', 'Electricity'],
    ['Internet router', 'Internet'],
    ['October rent', 'Rent'],
    ['Cena en el restaurante', 'Outside Food'],
  ])('"%s" → %s', (title, category) => {
    expect(guessExpenseCategory(title, HOUSE)).toBe(category);
  });

  it('leaves unknown titles alone', () => {
    expect(guessExpenseCategory('Birthday gift for Noam', HOUSE)).toBeNull();
    expect(guessExpenseCategory('  ', HOUSE)).toBeNull();
  });

  it("doesn't trip on words inside other words", () => {
    expect(guessExpenseCategory('Shower curtain', HOUSE)).not.toBe('Entertainment');
    expect(guessExpenseCategory('Electric kettle', HOUSE)).not.toBe('Electricity');
  });

  it("only suggests categories the house has, matching the house's spelling", () => {
    expect(guessExpenseCategory('Taxi', ['Rent', 'Other'])).toBeNull();
    expect(guessExpenseCategory('Taxi', ['transport', 'Other'])).toBe('transport');
  });
});
