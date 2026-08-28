import { z } from 'zod';
import {
  profileDetailsSchema,
  changePasswordSchema,
  parseAndValidateAddBill,
  derivePercentAmounts,
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

  it('never assigns a negative share when percentages overshoot within tolerance', () => {
    // 33.4 + 33.4 + 33.3 + 0 = 100.1 (accepted by the ±0.1 tolerance) would,
    // without clamping, leave the last person at -0.10. Every share must stay
    // >= 0 and the shares must still sum to the exact total.
    const p = parseAndValidateAddBill({
      ...base,
      amount: '100',
      selectedPeople: ['u1', 'u2', 'u3', 'u4'],
      splitType: 'percentage',
      percentAmounts: { u1: '33.4', u2: '33.4', u3: '33.3', u4: '0' },
    });
    const shares = Object.values(p.splitAmounts ?? {});
    for (const s of shares) expect(s).toBeGreaterThanOrEqual(0);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
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

describe('derivePercentAmounts', () => {
  const sum = (obj: Record<string, string>): number =>
    Object.values(obj).reduce((a, s) => a + parseFloat(s), 0);

  it('rebuilds simple percentages and sums to exactly 100', () => {
    const out = derivePercentAmounts(['a', 'b'], { a: 75, b: 25 }, 100);
    expect(out).toEqual({ a: '75', b: '25' });
    expect(sum(out)).toBe(100);
  });

  it('never produces a negative share on a rounding-boundary split', () => {
    // 33.36 / 33.36 / 33.25 / 0.03 rounds to 33.4 / 33.4 / 33.3, which would
    // overshoot 100 and leave the last person at -0.1 without clamping.
    const out = derivePercentAmounts(
      ['a', 'b', 'c', 'd'],
      { a: 33.36, b: 33.36, c: 33.25, d: 0.03 },
      100
    );
    for (const v of Object.values(out)) {
      expect(parseFloat(v)).toBeGreaterThanOrEqual(0);
    }
    expect(sum(out)).toBeCloseTo(100, 10);
  });

  it('gives the final person the remainder so the total stays 100', () => {
    const out = derivePercentAmounts(['a', 'b', 'c'], { a: 33.34, b: 33.33, c: 33.33 }, 100);
    expect(sum(out)).toBeCloseTo(100, 10);
  });
});
