import { z } from 'zod';

import {
  getPasswordByteLength,
  maximumPasswordBytes,
  minimumPasswordCharacters,
} from '../utils/password.js';

const displayName = z.string().trim().min(1).max(100);
const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(
    minimumPasswordCharacters,
    `Password must contain at least ${minimumPasswordCharacters} characters.`,
  )
  .refine((value) => getPasswordByteLength(value) <= maximumPasswordBytes, {
    message: `Password must not exceed ${maximumPasswordBytes} UTF-8 bytes.`,
  });
const timezone = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Timezone must be a valid IANA timezone identifier.' },
  );

export const registerSchema = z.object({ displayName, email, password }).strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(256) }).strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(256), newPassword: password })
  .strict()
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: 'New password must differ from the current password.',
    path: ['newPassword'],
  });

export const profileUpdateSchema = z.object({ displayName }).strict();

export const preferencesUpdateSchema = z
  .object({
    notificationsEnabled: z.boolean().optional(),
    preferredCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    renewalReminderDays: z.number().int().min(0).max(365).optional(),
    renewalRemindersEnabled: z.boolean().optional(),
    timezone: timezone.optional(),
    trialReminderDays: z.number().int().min(0).max(365).optional(),
    trialRemindersEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'At least one preference field is required.',
  });
