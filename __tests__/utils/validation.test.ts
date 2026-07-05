import { profileDetailsSchema, changePasswordSchema } from '@utils/validation';

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
