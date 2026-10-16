import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { getApiErrorMessage } from '../../api/http.js';
import { updatePayment } from '../../api/payments.js';
import { createRefund } from '../../api/refunds.js';
import { editPaymentSchema, refundSchema } from '../../forms/schemas.js';
import { Dialog } from '../../ui/Dialog.jsx';
import { Field, FormMessage, Input, Select, Textarea } from '../../ui/Field.jsx';
import Icon from '../../ui/Icon.jsx';
import { Pill } from '../../ui/Pill.jsx';
import { formatCurrency } from '../../utils/cost.js';

const today = () => new Date().toISOString().split('T')[0];

function RefundForm({ onClose, onSuccess, payment }) {
  const maxRefundable = Number(payment.remainingRefundable) || 0;
  const schema = useMemo(
    () => refundSchema(maxRefundable, formatCurrency(maxRefundable, payment.currencyCode)),
    [maxRefundable, payment.currencyCode],
  );
  const [error, setError] = useState('');
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({
    defaultValues: {
      amount: payment.remainingRefundable ? String(payment.remainingRefundable) : '',
      reason: '',
      refundDate: today(),
      refundStatus: 'completed',
    },
    resolver: zodResolver(schema),
  });

  async function submit(values) {
    setError('');
    try {
      const result = await createRefund(payment.id, {
        amount: Number(values.amount).toFixed(2),
        reason: values.reason.trim() || undefined,
        refundDate: values.refundDate,
        refundStatus: values.refundStatus,
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <>
      <dl className="neu-pressed depth-1 grid grid-cols-3 gap-2 rounded-2xl p-3 text-center text-xs">
        <div>
          <dt className="text-(--graphite)">Paid Amount</dt>
          <dd className="num mt-1 font-medium">
            {formatCurrency(payment.amount, payment.currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-(--graphite)">Total Refunded</dt>
          <dd className="num mt-1 font-medium">
            {formatCurrency(payment.totalRefunded, payment.currencyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-(--graphite)">Max Refundable</dt>
          <dd className="num mt-1 font-medium">
            {formatCurrency(payment.remainingRefundable, payment.currencyCode)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex items-start gap-3 rounded-2xl border-[1.5px] border-(--ink) p-3 text-xs leading-5">
        <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
        <p>
          <strong className="block">Provider Disclaimer</strong>
          Recording a refund here does not transfer funds or initiate a refund with the subscription
          provider.
        </p>
      </div>
      <form className="mt-5 space-y-4" noValidate onSubmit={handleSubmit(submit)}>
        <Field
          error={errors.amount?.message}
          id="refund-amount"
          label={`Refund Amount (${payment.currencyCode})`}
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              className="num"
              id={id}
              inputMode="decimal"
              invalid={invalid}
              max={maxRefundable}
              min="0.01"
              placeholder="0.00"
              step="0.01"
              type="number"
              {...register('amount')}
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field error={errors.refundDate?.message} id="refund-date" label="Refund Date">
            {(id, describedBy, invalid) => (
              <Input
                aria-describedby={describedBy}
                id={id}
                invalid={invalid}
                type="date"
                {...register('refundDate')}
              />
            )}
          </Field>
          <Field id="refund-status" label="Status">
            {(id) => (
              <Select id={id} {...register('refundStatus')}>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            )}
          </Field>
        </div>
        <Field error={errors.reason?.message} id="refund-reason" label="Reason / Notes (Optional)">
          {(id, describedBy, invalid) => (
            <Textarea
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              maxLength={500}
              placeholder="e.g. Overcharged, promo discount retroactive, service outage compensation"
              rows={2}
              {...register('reason')}
            />
          )}
        </Field>
        <FormMessage>{error}</FormMessage>
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Pill disabled={isSubmitting} onClick={onClose}>
            Cancel
          </Pill>
          <Pill disabled={isSubmitting} type="submit" variant="ink">
            {isSubmitting ? 'Recording...' : 'Record Refund'}
          </Pill>
        </div>
      </form>
    </>
  );
}

export function RefundDialog({ isOpen, onClose, onSuccess, payment }) {
  return (
    <Dialog
      description={`Payment ID #${payment.id} · ${payment.serviceName || payment.customServiceName}`}
      onOpenChange={(open) => !open && onClose()}
      open={isOpen}
      title="Record Manual Refund"
    >
      {isOpen && <RefundForm onClose={onClose} onSuccess={onSuccess} payment={payment} />}
    </Dialog>
  );
}

function EditForm({ onClose, onSuccess, payment }) {
  const hasRefunds = Number(payment.totalRefunded) > 0;
  const [error, setError] = useState('');
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({
    defaultValues: {
      amount: String(payment.amount ?? ''),
      billingPeriodEnd: payment.billingPeriodEnd || '',
      billingPeriodStart: payment.billingPeriodStart || '',
      notes: payment.notes || '',
      paymentStatus: payment.paymentStatus || 'completed',
    },
    resolver: zodResolver(editPaymentSchema),
  });

  async function submit(values) {
    setError('');
    // Same rule as before: send only the fields that changed.
    const updates = {};
    if (values.notes !== (payment.notes || '')) updates.notes = values.notes;
    if (values.billingPeriodStart !== (payment.billingPeriodStart || '')) {
      updates.billingPeriodStart = values.billingPeriodStart || null;
    }
    if (values.billingPeriodEnd !== (payment.billingPeriodEnd || '')) {
      updates.billingPeriodEnd = values.billingPeriodEnd || null;
    }
    if (values.paymentStatus !== payment.paymentStatus)
      updates.paymentStatus = values.paymentStatus;
    if (Number(values.amount) !== Number(payment.amount))
      updates.amount = Number(values.amount).toFixed(2);

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }
    try {
      const updated = await updatePayment(payment.id, updates);
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(submit)}>
      <div className="grid grid-cols-2 gap-3">
        <Field
          error={errors.amount?.message}
          hint={
            hasRefunds
              ? `Cannot be lower than refunded ${payment.currencyCode} ${payment.totalRefunded}.`
              : undefined
          }
          id="edit-amount"
          label={`Amount (${payment.currencyCode})`}
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              className="num"
              id={id}
              inputMode="decimal"
              invalid={invalid}
              min="0.01"
              step="0.01"
              type="number"
              {...register('amount')}
            />
          )}
        </Field>
        <Field
          hint={hasRefunds ? 'Locked to completed due to active refunds.' : undefined}
          id="edit-status"
          label="Status"
        >
          {(id, describedBy) => (
            <Select
              aria-describedby={describedBy}
              disabled={hasRefunds}
              id={id}
              {...register('paymentStatus')}
            >
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          )}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="edit-period-start" label="Billing Start">
          {(id) => <Input id={id} type="date" {...register('billingPeriodStart')} />}
        </Field>
        <Field error={errors.billingPeriodEnd?.message} id="edit-period-end" label="Billing End">
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              type="date"
              {...register('billingPeriodEnd')}
            />
          )}
        </Field>
      </div>
      <Field error={errors.notes?.message} id="edit-notes" label="Notes">
        {(id, describedBy, invalid) => (
          <Textarea
            aria-describedby={describedBy}
            id={id}
            invalid={invalid}
            maxLength={2000}
            rows={2}
            {...register('notes')}
          />
        )}
      </Field>
      <FormMessage>{error}</FormMessage>
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Pill disabled={isSubmitting} onClick={onClose}>
          Cancel
        </Pill>
        <Pill disabled={isSubmitting} type="submit" variant="ink">
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Pill>
      </div>
    </form>
  );
}

export function EditPaymentDialog({ isOpen, onClose, onSuccess, payment }) {
  return (
    <Dialog
      description={`Payment ID #${payment.id} · ${payment.serviceName || payment.customServiceName}`}
      onOpenChange={(open) => !open && onClose()}
      open={isOpen}
      title="Correct Payment Entry"
    >
      {isOpen && <EditForm onClose={onClose} onSuccess={onSuccess} payment={payment} />}
    </Dialog>
  );
}
