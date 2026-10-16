import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { createPayment } from '../api/payments.js';
import { getSubscriptions } from '../api/subscriptions.js';
import { paymentSchema } from '../forms/schemas.js';
import { pageIndex } from '../layout/nav.js';
import { Field, FormMessage, Input, Select, Textarea } from '../ui/Field.jsx';
import Icon from '../ui/Icon.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { BackLink, Pill, PillLink } from '../ui/Pill.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';
import { calculateEstimatedPeriodEnd, formatCurrency } from '../utils/cost.js';

const today = () => new Date().toISOString().split('T')[0];

export default function RecordPaymentPage() {
  const [searchParams] = useSearchParams();
  const preselectedSubId = searchParams.get('subscriptionId');
  const navigate = useNavigate();
  const { notify } = useToast();
  const [subscriptions, setSubscriptions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [error, setError] = useState('');

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm({
    defaultValues: {
      amount: '',
      billingPeriodEnd: '',
      billingPeriodStart: '',
      currencyCode: 'USD',
      notes: '',
      paymentDate: today(),
      paymentStatus: 'completed',
      subscriptionId: preselectedSubId || '',
    },
    resolver: zodResolver(paymentSchema),
  });
  const selectedSubId = useWatch({ control, name: 'subscriptionId' });
  const subscriptionField = register('subscriptionId');

  // Same autofill as before: amount, currency and an estimated billing period.
  function applySubscription(sub) {
    setValue('subscriptionId', String(sub.id));
    setValue('amount', String(sub.cost));
    setValue('currencyCode', sub.currencyCode);
    const baseDate = sub.renewalDate || sub.startDate || today();
    setValue('billingPeriodStart', baseDate);
    setValue('billingPeriodEnd', calculateEstimatedPeriodEnd(baseDate, sub.billingCycle));
  }

  useEffect(() => {
    getSubscriptions({ archived: 'false', limit: 100 })
      .then((data) => {
        const items = data.items || [];
        setSubscriptions(items);
        if (preselectedSubId) {
          const match = items.find((s) => String(s.id) === String(preselectedSubId));
          if (match) applySubscription(match);
        }
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoadingSubs(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per preselected id
  }, [preselectedSubId]);

  async function submit(values) {
    setError('');
    const payload = {
      amount: Number(values.amount).toFixed(2),
      currencyCode: values.currencyCode.toUpperCase(),
      notes: values.notes.trim() || undefined,
      paymentDate: values.paymentDate,
      paymentStatus: values.paymentStatus,
    };
    if (values.billingPeriodStart && values.billingPeriodEnd) {
      payload.billingPeriodStart = values.billingPeriodStart;
      payload.billingPeriodEnd = values.billingPeriodEnd;
    }
    const subscription = subscriptions.find((s) => String(s.id) === String(values.subscriptionId));
    try {
      const created = await createPayment(values.subscriptionId, payload);
      notify('Payment recorded.');
      navigate(`/payments/${created.payment.id}`, {
        state: {
          previousRenewalDate: subscription?.renewalDate ?? null,
          recorded: true,
          renewalDate: created.subscription?.renewalDate ?? null,
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackLink to="/payments">Back to Payments</BackLink>
      <PageHeader
        description="Manually log a subscription payment that occurred with your external service provider."
        index={pageIndex('/payments')}
        title="Record Payment"
      />

      <div className="neu-pressed depth-1 mb-6 flex items-start gap-3 rounded-2xl p-4 text-sm leading-6">
        <Icon className="mt-0.5 size-5 shrink-0" name="alert" />
        <p>
          <strong>Manual Financial Entry:</strong> SpendWise AI does not process cards or initiate
          external charges. Recorded payments represent historical entries you manually confirm.
        </p>
      </div>

      <form className="space-y-6" noValidate onSubmit={handleSubmit(submit)}>
        <Card look="glass">
          <CardHeader as="h2" title="Target Subscription" />
          <Field
            error={errors.subscriptionId?.message}
            id="sub-select"
            label="Select Subscription *"
          >
            {(id, describedBy, invalid) => (
              <Select
                aria-describedby={describedBy}
                disabled={loadingSubs}
                id={id}
                invalid={invalid}
                {...subscriptionField}
                onChange={(event) => {
                  subscriptionField.onChange(event);
                  const match = subscriptions.find((s) => String(s.id) === event.target.value);
                  if (match) applySubscription(match);
                  else {
                    setValue('amount', '');
                    setValue('billingPeriodStart', '');
                    setValue('billingPeriodEnd', '');
                  }
                }}
              >
                <option value="">
                  {loadingSubs ? 'Loading your subscriptions...' : '-- Choose a subscription --'}
                </option>
                {subscriptions.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.serviceName}
                    {sub.planName ? ` (${sub.planName})` : ''} —{' '}
                    {formatCurrency(sub.cost, sub.currencyCode)} / {sub.billingCycle}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Card>

        <Card delay={0.05}>
          <CardHeader as="h2" title="Payment Details" />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              error={errors.amount?.message}
              hint="Defaults to subscription price, but can be modified for historical variations."
              id="pay-amount"
              label="Amount Paid *"
            >
              {(id, describedBy, invalid) => (
                <Input
                  aria-describedby={describedBy}
                  className="num"
                  id={id}
                  inputMode="decimal"
                  invalid={invalid}
                  min="0.01"
                  placeholder="499.00"
                  step="0.01"
                  type="number"
                  {...register('amount')}
                />
              )}
            </Field>
            <Field
              error={errors.currencyCode?.message}
              id="pay-currency"
              label="Currency Code (ISO) *"
            >
              {(id, describedBy, invalid) => (
                <Input
                  aria-describedby={describedBy}
                  className="uppercase"
                  id={id}
                  invalid={invalid}
                  maxLength={3}
                  {...register('currencyCode', { setValueAs: (value) => value.toUpperCase() })}
                />
              )}
            </Field>
            <Field error={errors.paymentDate?.message} id="pay-date" label="Payment Date *">
              {(id, describedBy, invalid) => (
                <Input
                  aria-describedby={describedBy}
                  id={id}
                  invalid={invalid}
                  type="date"
                  {...register('paymentDate')}
                />
              )}
            </Field>
            <Field id="pay-status" label="Recorded Status *">
              {(id) => (
                <Select id={id} {...register('paymentStatus')}>
                  <option value="completed">Completed (Successfully paid)</option>
                  <option value="pending">Pending (Unconfirmed)</option>
                  <option value="failed">Failed (Declined / Unsuccessful)</option>
                  <option value="cancelled">Cancelled (Voided)</option>
                </Select>
              )}
            </Field>
          </div>
        </Card>

        <Card delay={0.1}>
          <CardHeader
            as="h2"
            description="Optional period covered by this payment (e.g. monthly billing cycle). Provide both dates or neither."
            title="Billing Coverage Period"
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="period-start" label="Period Start Date">
              {(id) => <Input id={id} type="date" {...register('billingPeriodStart')} />}
            </Field>
            <Field error={errors.billingPeriodEnd?.message} id="period-end" label="Period End Date">
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
        </Card>

        <Card delay={0.15}>
          <Field error={errors.notes?.message} id="pay-notes" label="Notes & Reference (Optional)">
            {(id, describedBy, invalid) => (
              <Textarea
                aria-describedby={describedBy}
                id={id}
                invalid={invalid}
                maxLength={2000}
                placeholder="Invoice number, payment method reference, or provider confirmation receipt notes"
                rows={3}
                {...register('notes')}
              />
            )}
          </Field>
        </Card>

        <div aria-live="assertive">
          <FormMessage>{error}</FormMessage>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <PillLink to="/payments">Cancel</PillLink>
          <Pill disabled={isSubmitting || !selectedSubId} type="submit" variant="ink">
            {isSubmitting ? 'Recording Payment...' : 'Record Payment'}
          </Pill>
        </div>
      </form>
    </div>
  );
}
