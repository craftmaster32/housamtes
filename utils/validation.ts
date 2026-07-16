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
