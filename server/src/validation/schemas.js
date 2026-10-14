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

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const validDateString = z
  .string()
  .regex(dateRegex, 'Date must be formatted as YYYY-MM-DD.')
  .refine(
    (value) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    },
    { message: 'Date must be a valid calendar date.' },
  );

export const entityId = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive()])
  .transform(String);

export const createSubscriptionSchema = z
  .object({
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']),
    categoryId: entityId,
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.'),
    customServiceName: z.string().trim().min(1).max(120).nullable().optional(),
    nextRenewalDate: validDateString.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    planName: z.string().trim().min(1).max(120).nullable().optional(),
    price: z
      .union([z.number(), z.string()])
      .pipe(z.coerce.number().min(0, 'Price must be 0 or greater.')),
    serviceId: entityId.nullable().optional(),
    startDate: validDateString,
    status: z.enum(['trial', 'active', 'paused', 'cancelled']).default('active'),
    trialEndDate: validDateString.nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      const hasService = Boolean(data.serviceId);
      const hasCustom = Boolean(data.customServiceName && data.customServiceName.trim().length > 0);
      return (hasService && !hasCustom) || (!hasService && hasCustom);
    },
    {
      message: 'Provide either a catalog service or a custom service name, not both.',
      path: ['serviceId'],
    },
  )
  .refine(
    (data) => {
      if (data.status === 'trial' || data.status === 'active') {
        return Boolean(data.nextRenewalDate);
      }
      return true;
    },
    {
      message: 'Next renewal date is required for active or trial subscriptions.',
      path: ['nextRenewalDate'],
    },
  )
  .refine(
    (data) => {
      if (data.nextRenewalDate && data.startDate) {
        return data.nextRenewalDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'Next renewal date must be on or after the start date.',
      path: ['nextRenewalDate'],
    },
  )
  .refine(
    (data) => {
      if (data.status === 'trial') {
        return Boolean(data.trialEndDate);
      }
      return true;
    },
    {
      message: 'Trial end date is required when status is trial.',
      path: ['trialEndDate'],
    },
  )
  .refine(
    (data) => {
      if (data.trialEndDate && data.startDate) {
        return data.trialEndDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'Trial end date must be on or after the start date.',
      path: ['trialEndDate'],
    },
  );

export const updateSubscriptionSchema = z
  .object({
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
    categoryId: entityId.optional(),
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .optional(),
    customServiceName: z.string().trim().min(1).max(120).nullable().optional(),
    nextRenewalDate: validDateString.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    planName: z.string().trim().min(1).max(120).nullable().optional(),
    price: z
      .union([z.number(), z.string()])
      .pipe(z.coerce.number().min(0, 'Price must be 0 or greater.'))
      .optional(),
    serviceId: entityId.nullable().optional(),
    startDate: validDateString.optional(),
    status: z.enum(['trial', 'active', 'paused', 'cancelled']).optional(),
    trialEndDate: validDateString.nullable().optional(),
  })
  .strict()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'At least one field is required to update subscription.',
  })
  .refine(
    (data) => {
      if (data.serviceId !== undefined && data.customServiceName !== undefined) {
        const hasService = Boolean(data.serviceId);
        const hasCustom = Boolean(
          data.customServiceName && data.customServiceName.trim().length > 0,
        );
        return (hasService && !hasCustom) || (!hasService && hasCustom);
      }
      return true;
    },
    {
      message: 'Provide either a catalog service or a custom service name, not both.',
      path: ['serviceId'],
    },
  )
  .refine(
    (data) => {
      if (data.startDate && data.nextRenewalDate) {
        return data.nextRenewalDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'Next renewal date must be on or after start date.',
      path: ['nextRenewalDate'],
    },
  )
  .refine(
    (data) => {
      if (data.startDate && data.trialEndDate) {
        return data.trialEndDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'Trial end date must be on or after start date.',
      path: ['trialEndDate'],
    },
  );

export const subscriptionQuerySchema = z
  .object({
    archived: z.enum(['true', 'false', 'all']).default('false'),
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
    categoryId: entityId.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    page: z.coerce.number().int().min(1).default(1),
    search: z.string().trim().max(120).optional(),
    sortBy: z
      .enum(['serviceName', 'price', 'nextRenewalDate', 'startDate', 'createdAt'])
      .default('createdAt'),
    sortOrder: z
      .enum(['asc', 'desc', 'ASC', 'DESC'])
      .default('desc')
      .transform((val) => val.toLowerCase()),
    status: z.enum(['trial', 'active', 'paused', 'cancelled']).optional(),
  })
  .strict();
