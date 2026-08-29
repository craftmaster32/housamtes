import { z } from 'zod';
import type { TFunction } from 'i18next';

const ZOD_MESSAGE_TO_I18N: Record<string, string> = {
  'Name is required': 'auth.name_required',
  'Name must be 50 characters or less': 'auth.name_too_long',
  'Email is required': 'auth.email_required',
  'Please enter a valid email address': 'auth.invalid_email',
  'Password is required': 'auth.password_required',
  'Password must be at least 8 characters': 'auth.password_min_length',
  'Include at least one uppercase letter': 'auth.password_needs_uppercase',
  'Include at least one number': 'auth.password_needs_number',
};

export function mapZodError(message: string, t: TFunction): string {
  const key = ZOD_MESSAGE_TO_I18N[message];
  return key ? t(key) : message;
}

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
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

export const profileDetailsSchema = z.object({
  name: signUpSchema.shape.name,
  email: signUpSchema.shape.email,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Please enter your current password.'),
    newPassword: signUpSchema.shape.password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const emailOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .toLowerCase(),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Please enter the 6-digit code from your email'),
});

// ── Add Bill Validation ──────────────────────────────────────────────────────

type SplitType = 'equal' | 'custom' | 'percentage';

export interface AddBillPayload {
  title: string;
  amount: number;
  paidBy: string;
  splitBetween: string[];
  splitAmounts: Record<string, number> | null;
  splitType: SplitType;
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
      // The ±0.1% tolerance above means the entered percentages can convert to
      // slightly more money than the bill. Cap each non-final share at what's
      // left and floor the final share at zero so a rounding overshoot can never
      // persist a negative amount — shares still sum to exactly the total.
      const remaining = Math.round((amountValue - running) * 100) / 100;
      if (i === parsed.selectedPeople.length - 1) {
        splitAmounts[id] = Math.max(0, remaining);
      } else {
        const raw = Math.round((pct / 100) * amountValue * 100) / 100;
        const share = Math.min(raw, Math.max(0, remaining));
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
    splitType: parsed.splitType,
    category: parsed.category,
    date: parsed.date,
  };
}

/**
 * Rebuild percentage inputs from stored money shares so a percentage-split bill
 * reopens in "% mode". Each non-final share is rounded to 0.1% and clamped to
 * the percentage still remaining, and the final person takes whatever is left —
 * so the values always sum to exactly 100 and never go negative (which would
 * otherwise let a save persist a negative monetary share).
 */
export function derivePercentAmounts(
  ids: string[],
  splitAmounts: Record<string, number>,
  total: number
): Record<string, string> {
  const result: Record<string, string> = {};
  let running = 0;
  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      result[id] = String(Math.round(Math.max(0, 100 - running) * 10) / 10);
    } else {
      const roundedPct = Math.round(((splitAmounts[id] ?? 0) / total) * 100 * 10) / 10;
      // Clamp to 0..remaining: the upper bound keeps the total at 100, and the
      // lower bound guards a legacy bill that stored a negative share (possible
      // before the split validator clamped them) from reconstructing negatives.
      const pct = Math.min(Math.max(0, roundedPct), Math.max(0, 100 - running));
      result[id] = String(pct);
      running += pct;
    }
  });
  return result;
}

export const houseNoteSchema = z.object({
  text: z.string().trim().min(1, 'Note text is required').max(500),
});

export const houseTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(100),
  description: z.string().trim().max(1000),
  priority: z.enum(['low', 'medium', 'high']),
  assignedTo: z.string().uuid().nullable(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be a valid date')
    .nullable(),
  houseId: z.string().min(1),
});

export const maintenanceRequestSchema = z.object({
  title: z.string().trim().min(1, 'Issue title is required').max(100),
  description: z.string().trim().max(1000),
  category: z.string().min(1, 'Category is required'),
  reportedBy: z.string().min(1),
  houseId: z.string().min(1),
});
