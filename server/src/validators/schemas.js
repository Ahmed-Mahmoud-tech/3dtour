import { z } from 'zod';

// Shared building blocks ─────────────────────────────────────────────────────
// A required non-empty string: rejects objects/arrays (which would otherwise
// reach Mongo as query operators — NoSQL injection) and blank input.
const nonEmpty = (label = 'This field') =>
  z.string({ message: `${label} is required` }).trim().min(1, `${label} is required`);

const email = z
  .string({ message: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(200)
  .email('Invalid email address');

const password = z
  .string({ message: 'Password is required' })
  .min(8, 'Password must be at least 8 characters');

// 24-hex Mongo ObjectId, or null to clear an assignment.
const objectIdOrNull = z
  .union([z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id'), z.null()])
  .optional()
  .transform((v) => v ?? null);

const optionalName = z.string().trim().min(1, 'Name must not be blank').max(100).optional();
const userStatus = z.enum(['active', 'suspended']).optional();

// Auth ────────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: nonEmpty('Name').max(100),
  email,
  password,
});

// Login stays permissive on length (don't leak the policy) but still string-only.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});

// Admin: users ──────────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  name: nonEmpty('Name').max(100),
  email,
  password,
});

export const updateUserSchema = z.object({
  name: optionalName,
  email: email.optional(),
  status: userStatus,
});

export const resetPasswordSchema = z.object({ password });

// Admin: subscriptions ────────────────────────────────────────────────────────
export const upsertSubscriptionSchema = z.object({
  plan: z.enum(['monthly', 'yearly'], { message: 'plan must be monthly or yearly' }),
  // Optional custom expiry; only a parseable date passes.
  expiresAt: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .refine(
      (v) => v === undefined || v === null || v === '' || !Number.isNaN(new Date(v).getTime()),
      'expiresAt must be a valid date'
    ),
});

export const subscriptionStatusSchema = z.object({
  status: z.enum(['active', 'canceled'], { message: 'status must be active or canceled' }),
});

// Admin: project access / assignment ──────────────────────────────────────────
export const assignOwnerSchema = z.object({ ownerId: objectIdOrNull });
export const assignEmployeeSchema = z.object({ employeeId: objectIdOrNull });

export const projectAccessSchema = z
  .object({
    suspended: z.boolean().optional(),
    expiryMode: z.enum(['subscription', 'date', 'lifetime']).optional(),
    expiryDate: z.string().optional(),
  })
  .refine(
    (v) =>
      v.expiryMode !== 'date' ||
      (typeof v.expiryDate === 'string' && !Number.isNaN(new Date(v.expiryDate).getTime())),
    { message: 'A valid expiryDate is required for mode date', path: ['expiryDate'] }
  );

// Projects ──────────────────────────────────────────────────────────────────
export const createProjectSchema = z.object({
  title: nonEmpty('Title').max(200),
  author: z.string().trim().max(200).optional(),
  nadirLogoUrl: z.string().trim().max(2000).optional(),
});

// Messages (public viewer contact form) ──────────────────────────────────────
export const submitMessageSchema = z.object({
  name: nonEmpty('Name').max(100),
  // Optional: allow empty string (no email given) or a valid address.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), 'Invalid email address'),
  message: nonEmpty('Message').max(2000),
  nodeId: z.string().max(64).optional(),
});
