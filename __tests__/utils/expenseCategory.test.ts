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
    // short brand/word terms must not match as substrings
    expect(guessExpenseCategory('Getting groceries', HOUSE)).not.toBe('Transport'); // gett
    expect(guessExpenseCategory('strength training', HOUSE)).not.toBe('Transport'); // tren
    expect(guessExpenseCategory('trendy cafe', HOUSE)).not.toBe('Transport'); // tren
    expect(guessExpenseCategory('tuber vegetables', HOUSE)).not.toBe('Transport'); // uber
    expect(guessExpenseCategory('Omega watch repair', HOUSE)).toBeNull(); // mega
    expect(guessExpenseCategory('Paracetamol para cenar', HOUSE)).not.toBe('Outside Food'); // cena inside
    expect(guessExpenseCategory('Revolt poster', HOUSE)).toBeNull(); // wolt
  });

  it("recognises the house's own categories by name", () => {
    const house = [...HOUSE, 'Gym', 'Cleaning'];
    expect(guessExpenseCategory('Gym membership', house)).toBe('Gym');
    expect(guessExpenseCategory('cleaning lady', house)).toBe('Cleaning');
    // The name has to start a word (so plurals count), not sit inside one.
    expect(guessExpenseCategory('Gymnastics shoes', ['Gym', 'Other'])).toBe('Gym'); // starts the word
    expect(guessExpenseCategory('Stargym pass', ['Gym', 'Other'])).toBeNull();
  });

  it('never picks Other by name', () => {
    expect(guessExpenseCategory('Other stuff', ['Other', 'Rent'])).toBeNull();
  });

  it("only suggests categories the house has, matching the house's spelling", () => {
    expect(guessExpenseCategory('Taxi', ['Rent', 'Other'])).toBeNull();
    expect(guessExpenseCategory('Taxi', ['transport', 'Other'])).toBe('transport');
  });
});
