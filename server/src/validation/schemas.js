import { z } from 'zod';

import {
  getPasswordByteLength,
  maximumPasswordBytes,
  minimumPasswordCharacters,
} from '../utils/password.js';

const name = z.string().trim().min(1).max(100);
const email = z
  .string()
  .trim()
  .email()
  .max(150)
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

export const registerSchema = z.object({ email, name, password }).strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(256) }).strict();

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(256), newPassword: password })
  .strict()
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: 'New password must differ from the current password.',
    path: ['newPassword'],
  });

export const profileUpdateSchema = z.object({ name }).strict();

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

// Identifiers are PostgreSQL INT: 1 .. 2147483647.
export const maximumEntityId = 2147483647;
export const entityId = z
  .union([z.string().regex(/^[1-9]\d{0,9}$/), z.number().int().positive()])
  .transform(String)
  .refine((value) => Number(value) <= maximumEntityId, 'Identifier is out of range.');

export const idParamsSchema = z.object({ id: entityId }).strict();

// Spec value sets (PostgreSQL ENUM labels, used verbatim in the API).
export const billingCycles = ['Monthly', 'Yearly'];
export const subscriptionStatuses = ['Active', 'Cancelled'];
export const recommendationStatuses = ['Pending', 'Reviewed', 'Dismissed'];
export const recommendationRules = [
  'unused_subscription',
  'above_category_average',
  'duplicate_category',
];

const currencyCode = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.');
const serviceName = z.string().trim().min(1).max(100);
const cost = z.union([z.number(), z.string()]).pipe(
  z.coerce
    .number()
    .positive('Cost must be greater than 0.')
    .max(999999.99, 'Cost must be below 1,000,000.')
    .refine(
      (value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6,
      'Cost cannot have more than 2 decimal places.',
    ),
);

export const createSubscriptionSchema = z
  .object({
    billingCycle: z.enum(billingCycles),
    categoryId: entityId,
    cost,
    currencyCode,
    lastUsedDate: validDateString.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    planName: z.string().trim().min(1).max(120).nullable().optional(),
    renewalDate: validDateString,
    serviceName,
    startDate: validDateString,
  })
  .strict()
  .refine((data) => data.renewalDate >= data.startDate, {
    message: 'Renewal date must be on or after the start date.',
    path: ['renewalDate'],
  })
  .refine((data) => !data.lastUsedDate || data.lastUsedDate >= data.startDate, {
    message: 'Last used date must be on or after the start date.',
    path: ['lastUsedDate'],
  });

export const updateSubscriptionSchema = z
  .object({
    billingCycle: z.enum(billingCycles).optional(),
    categoryId: entityId.optional(),
    cost: cost.optional(),
    currencyCode: currencyCode.optional(),
    lastUsedDate: validDateString.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    planName: z.string().trim().min(1).max(120).nullable().optional(),
    renewalDate: validDateString.optional(),
    serviceName: serviceName.optional(),
    startDate: validDateString.optional(),
    status: z.enum(subscriptionStatuses).optional(),
  })
  .strict()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'At least one field is required to update subscription.',
  })
  .refine((data) => !(data.startDate && data.renewalDate) || data.renewalDate >= data.startDate, {
    message: 'Renewal date must be on or after start date.',
    path: ['renewalDate'],
  });

export const subscriptionQuerySchema = z
  .object({
    archived: z.enum(['true', 'false', 'all']).default('false'),
    billingCycle: z.enum(billingCycles).optional(),
    categoryId: entityId.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    page: z.coerce.number().int().min(1).default(1),
    search: z.string().trim().max(120).optional(),
    sortBy: z
      .enum(['serviceName', 'cost', 'renewalDate', 'startDate', 'createdAt', 'lastUsedDate'])
      .default('createdAt'),
    sortOrder: z
      .enum(['asc', 'desc', 'ASC', 'DESC'])
      .default('desc')
      .transform((val) => val.toLowerCase()),
    status: z.enum(subscriptionStatuses).optional(),
    // FR8: only subscriptions not used for more than this many days.
    unusedDays: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .strict();

export const markUsedSchema = z.object({ lastUsedDate: validDateString.optional() }).strict();

export const subscriptionHistoryQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();

export const monetaryAmount = z
  .union([z.number(), z.string()])
  .pipe(
    z.coerce
      .number()
      .positive('Amount must be greater than 0.')
      .refine((val) => Number.isFinite(val), 'Amount must be a finite number.')
      .refine((val) => {
        const str = String(val);
        const parts = str.split('.');
        return parts.length < 2 || parts[1].length <= 2;
      }, 'Amount cannot have more than 2 decimal places.')
      .refine((val) => val < 1000000, 'Amount must be below 1,000,000.'),
  )
  .transform((val) => val.toFixed(2));

export const cancelSubscriptionSchema = z
  .object({
    finalPayment: z
      .object({
        amount: monetaryAmount,
        notes: z.string().max(2000).nullable().optional(),
        paymentDate: validDateString,
      })
      .strict()
      .optional(),
  })
  .strict();

export const createPaymentSchema = z
  .object({
    amount: monetaryAmount,
    billingPeriodEnd: validDateString.nullable().optional(),
    billingPeriodStart: validDateString.nullable().optional(),
    // Optional: defaults to the subscription's currency; a different currency is rejected.
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    notes: z.string().max(2000).nullable().optional(),
    paymentDate: validDateString,
    paymentStatus: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('completed'),
  })
  .strict()
  .refine(
    (data) => {
      const hasStart = Boolean(data.billingPeriodStart);
      const hasEnd = Boolean(data.billingPeriodEnd);
      return (hasStart && hasEnd) || (!hasStart && !hasEnd);
    },
    {
      message: 'Billing period start and end dates must either both be provided or both omitted.',
      path: ['billingPeriodEnd'],
    },
  )
  .refine(
    (data) => {
      if (data.billingPeriodStart && data.billingPeriodEnd) {
        return data.billingPeriodEnd >= data.billingPeriodStart;
      }
      return true;
    },
    {
      message: 'Billing period end date must be on or after billing period start date.',
      path: ['billingPeriodEnd'],
    },
  );

export const updatePaymentSchema = z
  .object({
    amount: monetaryAmount.optional(),
    billingPeriodEnd: validDateString.nullable().optional(),
    billingPeriodStart: validDateString.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    paymentDate: validDateString.optional(),
    paymentStatus: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  })
  .strict()
  .refine((values) => Object.keys(values).length > 0, {
    message: 'At least one field is required to update payment.',
  })
  .refine(
    (data) => {
      if (data.billingPeriodStart && data.billingPeriodEnd) {
        return data.billingPeriodEnd >= data.billingPeriodStart;
      }
      return true;
    },
    {
      message: 'Billing period end date must be on or after billing period start date.',
      path: ['billingPeriodEnd'],
    },
  );

export const paymentQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    page: z.coerce.number().int().min(1).default(1),
    paymentStatus: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
    sortBy: z.enum(['paymentDate', 'amount', 'createdAt']).default('paymentDate'),
    sortOrder: z
      .enum(['asc', 'desc', 'ASC', 'DESC'])
      .default('desc')
      .transform((val) => val.toLowerCase()),
    startDate: validDateString.optional(),
    status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
    subscriptionId: entityId.optional(),
  })
  .strict();

export const createRefundSchema = z
  .object({
    amount: monetaryAmount,
    reason: z.string().trim().min(1).max(500).nullable().optional(),
    refundDate: validDateString,
    refundStatus: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('completed'),
    status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  })
  .strict()
  .transform((data) => ({
    ...data,
    refundStatus: data.status || data.refundStatus,
  }));

export const billingQuerySchema = z
  .object({
    days: z.coerce.number().int().min(1).max(365).default(30),
  })
  .strict();

export const notificationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    page: z.coerce.number().int().min(1).default(1),
    type: z.enum(['renewal', 'system']).optional(),
    unreadOnly: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .strict();

export const recommendationQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    page: z.coerce.number().int().min(1).default(1),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    rule: z.enum(recommendationRules).optional(),
    sortBy: z
      .enum(['generatedDate', 'evaluatedAt', 'priority', 'potentialSavings'])
      .default('priority'),
    sortOrder: z
      .enum(['asc', 'desc', 'ASC', 'DESC'])
      .default('asc')
      .transform((value) => value.toLowerCase()),
    status: z.enum([...recommendationStatuses, 'all']).default('Pending'),
  })
  .strict();

export const recommendationStatusSchema = z
  .object({ status: z.enum(recommendationStatuses) })
  .strict();

export const analyticsDateRangeSchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    startDate: validDateString.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );

export const analyticsCategoryQuerySchema = z
  .object({
    categoryId: entityId.optional(),
    // Only categories whose total spend in the range reaches this amount (SQL HAVING).
    minAmount: z.coerce.number().min(0).max(99999999).optional(),
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    startDate: validDateString.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );

export const analyticsTrendsQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    interval: z.enum(['monthly', 'yearly']).default('monthly'),
    startDate: validDateString.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );

export const analyticsSubscriptionsQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    sortBy: z
      .enum(['grossPayments', 'netCashFlow', 'completedPaymentCount', 'serviceName', 'currentCost'])
      .default('grossPayments'),
    sortOrder: z
      .enum(['asc', 'desc', 'ASC', 'DESC'])
      .default('desc')
      .transform((val) => val.toLowerCase()),
    startDate: validDateString.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );

export const analyticsTopSubscriptionsQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(5),
    startDate: validDateString.optional(),
    type: z.enum(['recurring', 'historical']).default('recurring'),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );

export const analyticsBillingCyclesQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
  })
  .strict();

export const analyticsRefundsQuerySchema = z
  .object({
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    startDate: validDateString.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );

export const analyticsReportQuerySchema = z
  .object({
    categoryId: entityId.optional(),
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Currency code must be a 3-letter ISO code.')
      .transform((c) => c.toUpperCase())
      .optional(),
    endDate: validDateString.optional(),
    startDate: validDateString.optional(),
    subscriptionId: entityId.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: 'End date must be on or after start date.',
      path: ['endDate'],
    },
  );
