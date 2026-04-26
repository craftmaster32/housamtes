import { z } from 'zod';

export const signUpSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50, 'Name must be 50 characters or less')
    .trim(),
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
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
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

export const groceryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(100).trim(),
  quantity: z.string().max(20).trim(),
});
