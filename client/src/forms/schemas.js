import { z } from 'zod';

/*
 * Client-side form rules. They mirror the previous client checks and the backend contract
 * in server/src/validation/schemas.js (and the database CHECK constraints), so the UI
 * blocks exactly what the API would reject.
 * Login/register rules live in authRules.js (RHF built-ins) to keep Zod off public pages.
 */

const MIN_PASSWORD = 12;
const MAX_PASSWORD_BYTES = 72;
const byteLength = (value) => new TextEncoder().encode(value).length;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const currency = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Currency code must be a 3-letter ISO code.');
const twoDecimals = (value) =>
  !String(value).includes('.') || String(value).split('.')[1].length <= 2;

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(100, 'Name must be 100 characters or fewer.'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(256),
    newPassword: z
      .string()
      .min(MIN_PASSWORD, `Password must contain at least ${MIN_PASSWORD} characters.`)
      .refine((value) => byteLength(value) <= MAX_PASSWORD_BYTES, {
        message: `Password must not exceed ${MAX_PASSWORD_BYTES} UTF-8 bytes.`,
      }),
  })
  .refine((values) => values.currentPassword !== values.newPassword, {
    message: 'New password must differ from the current password.',
    path: ['newPassword'],
  });

const reminderDays = z.coerce
  .number({ error: 'Enter a whole number of days.' })
  .int('Enter a whole number of days.')
  .min(0, 'Use 0 to 365 days.')
  .max(365, 'Use 0 to 365 days.');

export const preferencesSchema = z.object({
  notificationsEnabled: z.boolean(),
  preferredCurrency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter uppercase ISO code, for example INR.'),
  renewalReminderDays: reminderDays,
  renewalRemindersEnabled: z.boolean(),
  timezone: z
    .string()
    .trim()
    .min(1, 'Enter an IANA timezone, for example Asia/Kolkata.')
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
    ),
});

export const subscriptionSchema = z
  .object({
    billingCycle: z.enum(['Monthly', 'Yearly']),
    categoryId: z.string().min(1, 'Please select a category.'),
    cost: z
      .string()
      .min(1, 'Cost must be greater than 0.')
      .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, {
        message: 'Cost must be greater than 0.',
      })
      .refine((value) => Number(value) < 1000000, { message: 'Cost must be below 1,000,000.' })
      .refine(twoDecimals, { message: 'Cost cannot have more than 2 decimal places.' }),
    currencyCode: currency,
    customServiceName: z.string().max(100, 'Use 100 characters or fewer.'),
    lastUsedDate: z.string(),
    notes: z.string().max(2000, 'Notes must be 2000 characters or fewer.'),
    planName: z.string().max(120, 'Use 120 characters or fewer.'),
    renewalDate: z.string().regex(isoDate, 'Enter the renewal date.'),
    serviceId: z.string(),
    serviceMode: z.enum(['catalog', 'custom']),
    startDate: z.string().regex(isoDate, 'Enter a start date.'),
    status: z.enum(['Active', 'Cancelled']),
  })
  .superRefine((data, context) => {
    if (data.serviceMode === 'catalog' && !data.serviceId) {
      context.addIssue({
        code: 'custom',
        message: 'Please select a catalog service.',
        path: ['serviceId'],
      });
    }
    if (data.serviceMode === 'custom' && !data.customServiceName.trim()) {
      context.addIssue({
        code: 'custom',
        message: 'Please enter a service name.',
        path: ['customServiceName'],
      });
    }
    if (data.renewalDate && data.startDate && data.renewalDate < data.startDate) {
      context.addIssue({
        code: 'custom',
        message: 'Renewal date must be on or after the start date.',
        path: ['renewalDate'],
      });
    }
    if (data.lastUsedDate && data.startDate && data.lastUsedDate < data.startDate) {
      context.addIssue({
        code: 'custom',
        message: 'Last used date must be on or after the start date.',
        path: ['lastUsedDate'],
      });
    }
  });

/** Request body for POST/PATCH /subscriptions from validated form values. */
export function toSubscriptionPayload(values, services, { includeStatus = false } = {}) {
  const serviceName =
    values.serviceMode === 'catalog'
      ? services.find((service) => service.id === values.serviceId)?.name
      : values.customServiceName.trim();
  const payload = {
    billingCycle: values.billingCycle,
    categoryId: values.categoryId,
    cost: Number(values.cost),
    currencyCode: values.currencyCode.toUpperCase(),
    lastUsedDate: values.lastUsedDate || null,
    notes: values.notes.trim() || null,
    planName: values.planName.trim() || null,
    renewalDate: values.renewalDate,
    serviceName,
    startDate: values.startDate,
  };
  if (includeStatus) payload.status = values.status;
  return payload;
}

/** Final payment for POST /subscriptions/:id/cancel (both fields optional together). */
export const cancelSchema = z
  .object({
    amount: z.string(),
    includePayment: z.boolean(),
    paymentDate: z.string(),
  })
  .superRefine((data, context) => {
    if (!data.includePayment) return;
    if (!(Number.isFinite(Number(data.amount)) && Number(data.amount) > 0)) {
      context.addIssue({ code: 'custom', message: 'Amount must be greater than 0.', path: ['amount'] });
    } else if (!twoDecimals(data.amount)) {
      context.addIssue({ code: 'custom', message: 'Amount cannot have more than 2 decimal places.', path: ['amount'] });
    }
    if (!isoDate.test(data.paymentDate)) {
      context.addIssue({ code: 'custom', message: 'Enter the payment date.', path: ['paymentDate'] });
    }
  });

const positiveAmount = (message) =>
  z
    .string()
    .min(1, message)
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, { message })
    .refine(twoDecimals, { message: 'Amount cannot have more than 2 decimal places.' });

function periodRule(data, context) {
  const hasStart = Boolean(data.billingPeriodStart);
  const hasEnd = Boolean(data.billingPeriodEnd);
  if (hasStart !== hasEnd) {
    context.addIssue({
      code: 'custom',
      message: 'Billing period start and end dates must either both be provided or both omitted.',
      path: ['billingPeriodEnd'],
    });
  } else if (hasStart && data.billingPeriodEnd < data.billingPeriodStart) {
    context.addIssue({
      code: 'custom',
      message: 'Billing period end date must be on or after start date.',
      path: ['billingPeriodEnd'],
    });
  }
}

export const paymentSchema = z
  .object({
    amount: positiveAmount('Payment amount must be greater than zero.'),
    billingPeriodEnd: z.string(),
    billingPeriodStart: z.string(),
    currencyCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'Currency code must be a 3-letter ISO code.'),
    notes: z.string().max(2000, 'Notes must be 2000 characters or fewer.'),
    paymentDate: z.string().regex(isoDate, 'Enter the payment date.'),
    paymentStatus: z.enum(['completed', 'pending', 'failed', 'cancelled']),
    subscriptionId: z.string().min(1, 'Please select a subscription.'),
  })
  .superRefine(periodRule);

export const editPaymentSchema = z
  .object({
    amount: positiveAmount('Amount must be greater than 0.'),
    billingPeriodEnd: z.string(),
    billingPeriodStart: z.string(),
    notes: z.string().max(2000, 'Notes must be 2000 characters or fewer.'),
    paymentStatus: z.enum(['completed', 'pending', 'failed', 'cancelled']),
  })
  .superRefine((data, context) => {
    if (
      data.billingPeriodStart &&
      data.billingPeriodEnd &&
      data.billingPeriodEnd < data.billingPeriodStart
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Billing period end date must be on or after billing period start date.',
        path: ['billingPeriodEnd'],
      });
    }
  });

export function refundSchema(maxRefundable, formatMax) {
  return z.object({
    amount: positiveAmount('Refund amount must be greater than zero.').refine(
      (value) => Number(value) <= maxRefundable,
      { message: `Refund amount cannot exceed remaining refundable balance of ${formatMax}.` },
    ),
    reason: z.string().max(500, 'Reason must be 500 characters or fewer.'),
    refundDate: z.string().regex(isoDate, 'Enter the refund date.'),
    refundStatus: z.enum(['completed', 'pending', 'failed', 'cancelled']),
  });
}
