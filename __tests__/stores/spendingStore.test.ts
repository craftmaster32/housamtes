import { useSpendingStore, type MonthSpend } from '@stores/spendingStore';
import { ok, fail } from '../__helpers__/supabaseMock';

const mockFrom = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]): unknown => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]): unknown => mockInvoke(...args),
    },
  },
}));

jest.mock('@lib/errorTracking', () => ({ captureError: jest.fn() }));

jest.mock('@stores/authStore', () => ({
  useAuthStore: {
    getState: (): {
      houseId: string;
      profile: { id: string; name: string };
    } => ({
      houseId: 'house-1',
      profile: { id: 'user-1', name: 'Lior' },
    }),
  },
}));

function currentMonthDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
}

function month(overrides: Partial<MonthSpend> = {}): MonthSpend {
  const monthKey = currentMonthDate().slice(0, 7);
  return {
    month: monthKey,
    label: 'This month',
    total: 30,
    houseTotal: 90,
    categories: [{ name: 'internet', icon: '', color: '#000000', amount: 30, isHouse: true }],
    houseCategories: [{ name: 'internet', icon: '', color: '#000000', amount: 90, isHouse: true }],
    billsByCategory: {},
    ...overrides,
  };
}

beforeEach(() => {
  useSpendingStore.setState({
    months: [],
    isLoading: false,
    error: null,
    insight: null,
    insightError: null,
    insightLoading: false,
    insightMonth: null,
    insightCurrency: null,
    insightUser: null,
  });
  mockFrom.mockReset();
  mockInvoke.mockReset();
});

describe('spendingStore', () => {
  it('calculates the current user share from UUID split_between values', async () => {
    mockFrom.mockImplementation((table: string): unknown => {
      if (table === 'bills') {
        return ok([
          {
            id: 'bill-1',
            title: 'Internet',
            amount: 90,
            paid_by: 'user-2',
            split_between: ['user-1', 'user-2', 'user-3'],
            date: currentMonthDate(),
            category: 'Internet',
          },
        ]);
      }

      if (table === 'household_payments') return ok([]);

      return ok([]);
    });

    await useSpendingStore.getState().load('house-1', 'Lior');

    const current = useSpendingStore.getState().months[0];
    expect(current.houseTotal).toBeCloseTo(90);
    expect(current.total).toBeCloseTo(30);
    expect(current.categories[0].name).toBe('internet');
  });

  it('stores an insight when the Edge Function succeeds', async () => {
    const current = month();
    useSpendingStore.setState({ months: [current], insightError: 'Old error' });
    mockInvoke.mockResolvedValue({
      data: { insight: 'Internet is the biggest cost this month.' },
      error: null,
    });

    await useSpendingStore.getState().fetchInsight('house-1', 'Lior', '$');

    expect(mockInvoke).toHaveBeenCalledWith('spending-analysis', {
      body: { months: [current], userName: 'Lior', currency: '$' },
    });
    expect(useSpendingStore.getState().insight).toBe('Internet is the biggest cost this month.');
    expect(useSpendingStore.getState().insightError).toBeNull();
  });

  it('keeps spending visible and stores an AI-specific error when insight fails', async () => {
    useSpendingStore.setState({ months: [month()], error: null });
    mockInvoke.mockResolvedValue({
      data: {
        error: 'AI analysis is not connected yet. Add ANTHROPIC_API_KEY in Supabase secrets.',
      },
      error: null,
    });

    await useSpendingStore.getState().fetchInsight('house-1', 'Lior', '$');

    expect(useSpendingStore.getState().error).toBeNull();
    expect(useSpendingStore.getState().insight).toBeNull();
    expect(useSpendingStore.getState().insightError).toBe(
      'AI analysis is not connected yet. Add the Claude API key in Supabase secrets.'
    );
  });
  it('splits a bimonthly recurring payment across the two covered months', async () => {
    mockFrom.mockImplementation((table: string): unknown => {
      if (table === 'household_payments') {
        return ok([
          {
            id: 'pay-1',
            amount: 200,
            paid_at: currentMonthDate(),
            recurring_bills: { name: 'Water', assigned_to: 'user-1', frequency: 'bimonthly' },
          },
        ]);
      }
      return ok([]);
    });

    await useSpendingStore.getState().load('house-1', 'Lior');

    const [current, previous] = useSpendingStore.getState().months;
    // 200 over two months → 100 each, credited to the assignee (the current user).
    expect(current.houseTotal).toBeCloseTo(100);
    expect(current.total).toBeCloseTo(100);
    expect(previous.houseTotal).toBeCloseTo(100);
    expect(current.categories[0].name).toBe('water');
    // Drill-down labels the slice so users understand the halved amount.
    expect(current.billsByCategory['water'][0].title).toBe('Water (2-month split)');
  });

  it('classifies a Hebrew-named recurring bill (ארנונה) as a house bill', async () => {
    mockFrom.mockImplementation((table: string): unknown => {
      if (table === 'household_payments') {
        return ok([
          {
            id: 'pay-1',
            amount: 388.5,
            paid_at: currentMonthDate(),
            recurring_bills: { name: 'ארנונה', assigned_to: 'user-1', frequency: 'bimonthly' },
          },
        ]);
      }
      return ok([]);
    });

    await useSpendingStore.getState().load('house-1', 'Lior');

    const current = useSpendingStore.getState().months[0];
    const arnona = current.houseCategories.find((c) => c.name === 'ארנונה');
    expect(arnona).toBeDefined();
    // Recurring household bills are house bills whatever they're named.
    expect(arnona?.isHouse).toBe(true);
  });

  it('classifies a one-off Hebrew utility bill (חשמל) as a house bill', async () => {
    mockFrom.mockImplementation((table: string): unknown => {
      if (table === 'bills') {
        return ok([
          {
            id: 'bill-1',
            title: 'חשמל',
            amount: 120,
            paid_by: 'user-1',
            split_between: ['user-1'],
            date: currentMonthDate(),
            category: 'חשמל',
          },
        ]);
      }
      return ok([]);
    });

    await useSpendingStore.getState().load('house-1', 'Lior');

    const current = useSpendingStore.getState().months[0];
    expect(current.houseCategories.find((c) => c.name === 'חשמל')?.isHouse).toBe(true);
  });

  it('leaves a non-house category (groceries) out of the house section', async () => {
    mockFrom.mockImplementation((table: string): unknown => {
      if (table === 'bills') {
        return ok([
          {
            id: 'bill-1',
            title: 'Groceries',
            amount: 50,
            paid_by: 'user-1',
            split_between: ['user-1'],
            date: currentMonthDate(),
            category: 'Groceries',
          },
        ]);
      }
      return ok([]);
    });

    await useSpendingStore.getState().load('house-1', 'Lior');

    const current = useSpendingStore.getState().months[0];
    expect(current.houseCategories.find((c) => c.name === 'groceries')?.isHouse).toBe(false);
  });

  it('does not credit recurring payments assigned to someone else to the user', async () => {
    mockFrom.mockImplementation((table: string): unknown => {
      if (table === 'household_payments') {
        return ok([
          {
            id: 'pay-1',
            amount: 300,
            paid_at: currentMonthDate(),
            recurring_bills: { name: 'Rent', assigned_to: 'user-2', frequency: 'monthly' },
          },
        ]);
      }
      return ok([]);
    });

    await useSpendingStore.getState().load('house-1', 'Lior');

    const current = useSpendingStore.getState().months[0];
    expect(current.houseTotal).toBeCloseTo(300);
    expect(current.total).toBe(0);
  });

  it('sets a user-facing error when the load query fails', async () => {
    mockFrom.mockImplementation(() => fail('db down'));

    await useSpendingStore.getState().load('house-1', 'Lior');

    const s = useSpendingStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe('Failed to load spending data');
  });

  it('aborts the load when the house ID does not match auth', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await useSpendingStore.getState().load('another-house', 'Lior');

    expect(mockFrom).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reuses the cached insight for the same month, user and currency', async () => {
    const current = month();
    useSpendingStore.setState({
      months: [current],
      insight: 'Cached insight',
      insightMonth: current.month,
      insightCurrency: '$',
      insightUser: 'Lior',
    });

    await useSpendingStore.getState().fetchInsight('house-1', 'Lior', '$');

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(useSpendingStore.getState().insight).toBe('Cached insight');
  });

  it('refetches the insight when the currency changes', async () => {
    const current = month();
    useSpendingStore.setState({
      months: [current],
      insight: 'Cached insight',
      insightMonth: current.month,
      insightCurrency: '$',
      insightUser: 'Lior',
    });
    mockInvoke.mockResolvedValue({ data: { insight: 'Fresh in euros.' }, error: null });

    await useSpendingStore.getState().fetchInsight('house-1', 'Lior', '\u20ac');

    expect(mockInvoke).toHaveBeenCalled();
    expect(useSpendingStore.getState().insight).toBe('Fresh in euros.');
  });

  it('shows the generic AI message when the function returns an empty insight', async () => {
    useSpendingStore.setState({ months: [month()] });
    mockInvoke.mockResolvedValue({ data: { insight: '   ' }, error: null });

    await useSpendingStore.getState().fetchInsight('house-1', 'Lior', '$');

    expect(useSpendingStore.getState().insight).toBeNull();
    // Local errors that carry no recognised server reason fall back to the generic copy.
    expect(useSpendingStore.getState().insightError).toBe(
      'AI analysis is not available right now. Try again.'
    );
  });

  it('maps rate-limit errors to a friendly busy message', async () => {
    useSpendingStore.setState({ months: [month()] });
    mockInvoke.mockResolvedValue({ data: null, error: new Error('rate limit exceeded') });

    await useSpendingStore.getState().fetchInsight('house-1', 'Lior', '$');

    expect(useSpendingStore.getState().insightError).toBe(
      'AI analysis is busy right now. Try again in a minute.'
    );
  });

  it('is a no-op when there is no spending data yet', async () => {
    useSpendingStore.setState({ months: [] });

    await useSpendingStore.getState().fetchInsight('house-1', 'Lior', '$');

    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
