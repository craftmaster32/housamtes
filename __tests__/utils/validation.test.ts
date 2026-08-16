import { z } from 'zod';
import {
  profileDetailsSchema,
  changePasswordSchema,
  parseAndValidateAddBill,
} from '@utils/validation';

describe('profileDetailsSchema', () => {
  it('accepts a valid name and email', () => {
    const result = profileDetailsSchema.safeParse({ name: 'Jane Doe', email: 'jane@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = profileDetailsSchema.safeParse({ name: '  ', email: 'jane@example.com' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email format', () => {
    const result = profileDetailsSchema.safeParse({ name: 'Jane Doe', email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('lowercases the email', () => {
    const result = profileDetailsSchema.safeParse({ name: 'Jane Doe', email: 'JANE@EXAMPLE.COM' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('jane@example.com');
    }
  });
});

describe('changePasswordSchema', () => {
  const base = {
    currentPassword: 'oldpassword1A',
    newPassword: 'NewPassword1',
    confirmPassword: 'NewPassword1',
  };

  it('accepts matching, strong passwords', () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });

  it('requires a current password', () => {
    const result = changePasswordSchema.safeParse({ ...base, currentPassword: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a new password shorter than 8 characters', () => {
    const result = changePasswordSchema.safeParse({
      ...base,
      newPassword: 'Ab1',
      confirmPassword: 'Ab1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a new password missing an uppercase letter', () => {
    const result = changePasswordSchema.safeParse({
      ...base,
      newPassword: 'newpassword1',
      confirmPassword: 'newpassword1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a new password missing a number', () => {
    const result = changePasswordSchema.safeParse({
      ...base,
      newPassword: 'NewPassword',
      confirmPassword: 'NewPassword',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched confirm password', () => {
    const result = changePasswordSchema.safeParse({ ...base, confirmPassword: 'Different1' });
    expect(result.success).toBe(false);
  });
});

describe('parseAndValidateAddBill — split calculation', () => {
  const base = {
    title: 'Groceries',
    amount: '60',
    paidBy: 'u1',
    selectedPeople: ['u1', 'u2', 'u3'],
    category: 'Groceries',
    date: '2026-08-14',
    customAmounts: {},
    percentAmounts: {},
  };

  it('equal split leaves splitAmounts null (billsStore divides evenly)', () => {
    const p = parseAndValidateAddBill({ ...base, splitType: 'equal' });
    expect(p.splitAmounts).toBeNull();
    expect(p.amount).toBe(60);
    expect(p.splitBetween).toEqual(['u1', 'u2', 'u3']);
  });

  it('custom split builds a per-person amount map that sums to the total', () => {
    const p = parseAndValidateAddBill({
      ...base,
      splitType: 'custom',
      customAmounts: { u1: '10', u2: '20', u3: '30' },
    });
    expect(p.splitAmounts).toEqual({ u1: 10, u2: 20, u3: 30 });
  });

  it('throws when custom amounts do not add up to the total', () => {
    expect(() =>
      parseAndValidateAddBill({
        ...base,
        splitType: 'custom',
        customAmounts: { u1: '10', u2: '20', u3: '5' }, // 35 ≠ 60
      })
    ).toThrow(z.ZodError);
  });

  it('percentage split converts to amounts and the last person absorbs rounding', () => {
    // 10 split 33.33 / 33.33 / 33.34 — fractional cents, last person carries the
    // rounding so the shares still sum to the exact total.
    const p = parseAndValidateAddBill({
      ...base,
      amount: '10',
      splitType: 'percentage',
      percentAmounts: { u1: '33.33', u2: '33.33', u3: '33.34' },
    });
    expect(p.splitAmounts).toEqual({ u1: 3.33, u2: 3.33, u3: 3.34 });
    const sum = Object.values(p.splitAmounts ?? {}).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(10, 10);
  });

  it('throws when percentages do not add up to 100', () => {
    expect(() =>
      parseAndValidateAddBill({
        ...base,
        splitType: 'percentage',
        percentAmounts: { u1: '50', u2: '25', u3: '10' }, // 85 ≠ 100
      })
    ).toThrow(z.ZodError);
  });

  it('throws on a zero amount', () => {
    expect(() => parseAndValidateAddBill({ ...base, amount: '0', splitType: 'equal' })).toThrow(
      z.ZodError
    );
  });

  it('throws on an empty amount', () => {
    expect(() => parseAndValidateAddBill({ ...base, amount: '', splitType: 'equal' })).toThrow(
      z.ZodError
    );
  });
});
