import { z } from 'zod';

/*
 * Client-side form rules. They mirror the previous client checks and the backend contract
 * in server/src/validation/schemas.js (and the database CHECK constraints), so the UI
 * blocks exactly what the API would reject. Payload field names are unchanged.
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
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter a display name.')
    .max(100, 'Display name must be 100 characters or fewer.'),
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
  trialReminderDays: reminderDays,
  trialRemindersEnabled: z.boolean(),
});

export const subscriptionSchema = z
  .object({
    billingCycle: z.enum(['monthly', 'quarterly', 'yearly']),
    categoryId: z.string().min(1, 'Please select a category.'),
    currencyCode: currency,
    customServiceName: z.string().max(120, 'Use 120 characters or fewer.'),
    nextRenewalDate: z.string(),
    notes: z.string().max(2000, 'Notes must be 2000 characters or fewer.'),
    planName: z.string().max(120, 'Use 120 characters or fewer.'),
    price: z
      .string()
      .min(1, 'Price must be 0 or greater.')
      .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
        message: 'Price must be 0 or greater.',
      }),
    serviceId: z.string(),
    serviceMode: z.enum(['catalog', 'custom']),
    startDate: z.string().regex(isoDate, 'Enter a start date.'),
    status: z.enum(['active', 'trial', 'paused', 'cancelled']),
    trialEndDate: z.string(),
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
        message: 'Please enter a custom service name.',
        path: ['customServiceName'],
      });
    }
    if ((data.status === 'active' || data.status === 'trial') && !data.nextRenewalDate) {
      context.addIssue({
        code: 'custom',
        message: 'Next renewal date is required for active or trial subscriptions.',
        path: ['nextRenewalDate'],
      });
    }
    if (data.nextRenewalDate && data.startDate && data.nextRenewalDate < data.startDate) {
      context.addIssue({
        code: 'custom',
        message: 'Next renewal date must be on or after the start date.',
        path: ['nextRenewalDate'],
      });
    }
    if (data.status === 'trial' && !data.trialEndDate) {
      context.addIssue({
        code: 'custom',
        message: 'Trial end date is required when status is trial.',
        path: ['trialEndDate'],
      });
    }
    if (
      data.status === 'trial' &&
      data.trialEndDate &&
      data.startDate &&
      data.trialEndDate < data.startDate
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Trial end date must be on or after the start date.',
        path: ['trialEndDate'],
      });
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
