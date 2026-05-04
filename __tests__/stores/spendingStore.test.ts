import { useSpendingStore, type MonthSpend } from '../../stores/spendingStore';
import { ok } from '../__helpers__/supabaseMock';

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
    categories: [{ name: 'internet', icon: '', color: '#000000', amount: 30 }],
    houseCategories: [{ name: 'internet', icon: '', color: '#000000', amount: 90 }],
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
});
