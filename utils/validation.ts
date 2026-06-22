import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less').trim(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

export const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const houseNameSchema = z.object({
  name: z
    .string()
    .min(1, 'House name is required')
    .max(60, 'House name must be 60 characters or less')
    .trim(),
});

export const billSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100).trim(),
  amount: z.number().positive('Amount must be greater than 0').max(999999),
  paidBy: z.string().min(1, 'Select who paid'),
});

// ── Add Bill Validation ──────────────────────────────────────────────────────

type SplitType = 'equal' | 'custom' | 'percentage';

export interface AddBillPayload {
  title: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  splitAmounts: Record<string, number> | null;
  category: string;
  date: string;
}

export function parseAmount(raw: string): number {
  const n = parseFloat(raw.trim().replace(/,/g, '.'));
  return isFinite(n) && n >= 0 ? n : 0;
}

const addBillBaseSchema = z.object({
  title: z.string().min(1, 'bills.enter_title').trim(),
  amount: z.string().min(1, 'bills.enter_valid_amount'),
  paidBy: z.string().min(1, 'bills.select_who_paid'),
  selectedPeople: z.array(z.string()).min(1, 'bills.select_split'),
  splitType: z.enum(['equal', 'custom', 'percentage']),
  customAmounts: z.record(z.string()),
  percentAmounts: z.record(z.string()),
  category: z.string(),
  date: z.string(),
});

export function parseAndValidateAddBill(input: {
  title: string;
  amount: string;
  paidBy: string;
  selectedPeople: string[];
  splitType: SplitType;
  customAmounts: Record<string, string>;
  percentAmounts: Record<string, string>;
  category: string;
  date: string;
}): AddBillPayload {
  // Basic validation
  const parsed = addBillBaseSchema.parse(input);

  // Parse amount
  const amountValue = parseAmount(parsed.amount);
  if (amountValue <= 0) {
    throw new z.ZodError([
      {
        code: 'custom',
        message: 'bills.enter_valid_amount',
        path: ['amount'],
      },
    ]);
  }

  let splitAmounts: Record<string, number> | null = null;

  if (parsed.splitType === 'custom') {
    const customTotal = parsed.selectedPeople.reduce(
      (sum: number, id: string) => sum + parseAmount(parsed.customAmounts[id] ?? '0'),
      0
    );
    if (Math.abs(customTotal - amountValue) > 0.01) {
      throw new z.ZodError([
        {
          code: 'custom',
          message: 'bills.custom_total_mismatch',
          path: ['customAmounts'],
          params: {
            entered: customTotal.toFixed(2),
            total: amountValue.toFixed(2),
          },
        },
      ]);
    }
    splitAmounts = {};
    for (const id of parsed.selectedPeople) {
      splitAmounts[id] = parseAmount(parsed.customAmounts[id] ?? '0');
    }
  } else if (parsed.splitType === 'percentage') {
    const pctTotal = parsed.selectedPeople.reduce(
      (sum: number, id: string) => sum + parseAmount(parsed.percentAmounts[id] ?? '0'),
      0
    );
    if (Math.abs(pctTotal - 100) > 0.1) {
      throw new z.ZodError([
        {
          code: 'custom',
          message: 'bills.pct_total_mismatch',
          path: ['percentAmounts'],
          params: { pct: pctTotal.toFixed(1) },
        },
      ]);
    }
    splitAmounts = {};
    let running = 0;
    for (let i = 0; i < parsed.selectedPeople.length; i++) {
      const id = parsed.selectedPeople[i];
      const pct = parseAmount(parsed.percentAmounts[id] ?? '0');
      if (i === parsed.selectedPeople.length - 1) {
        splitAmounts[id] = Math.round((amountValue - running) * 100) / 100;
      } else {
        const share = Math.round((pct / 100) * amountValue * 100) / 100;
        splitAmounts[id] = share;
        running += share;
      }
    }
  }

  return {
    title: parsed.title.trim(),
    amount: amountValue,
    paidBy: parsed.paidBy,
    splitBetween: parsed.selectedPeople,
    splitAmounts,
    category: parsed.category,
    date: parsed.date,
  };
}

export const groceryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100).trim(),
  quantity: z.string().max(20).trim(),
});

export const inviteSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
});

export function isValidHouseName(name: string): boolean {
  return name.trim().length >= 1 && name.trim().length <= 60;
}
