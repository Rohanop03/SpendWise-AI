import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { computeRenewalDate } from '../../forms/renewal.js';
import { subscriptionSchema } from '../../forms/schemas.js';
import { Field, FormMessage, Input, Select, Textarea } from '../../ui/Field.jsx';
import { Pill, PillLink } from '../../ui/Pill.jsx';
import Segmented from '../../ui/Segmented.jsx';

/**
 * Add / edit subscription form. Field names, defaults and the submitted payload shape are
 * decided by the page (`onSubmit` receives validated values), exactly as before.
 */
export default function SubscriptionForm({
  apiError,
  cancelTo,
  categories,
  defaultValues,
  onSubmit,
  services,
  submitLabel,
  submittingLabel,
}) {
  const {
    control,
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = useForm({ defaultValues, resolver: zodResolver(subscriptionSchema) });

  const [serviceMode, status, startDate] = useWatch({
    control,
    name: ['serviceMode', 'status', 'startDate'],
  });
  const serviceField = register('serviceId');

  function switchMode(mode) {
    setValue('serviceMode', mode);
    if (mode === 'custom') setValue('serviceId', '');
    else setValue('customServiceName', '');
  }

  return (
    <form className="space-y-7" noValidate onSubmit={handleSubmit(onSubmit)}>
      <fieldset className="space-y-4">
        <legend className="field-label">Service Provider</legend>
        <div className="grid grid-cols-2 gap-2 neu-pressed depth-1 rounded-full p-1" role="group">
          {[
            ['catalog', 'Popular Catalog Service'],
            ['custom', 'Custom Service'],
          ].map(([mode, label]) => (
            <button
              aria-pressed={serviceMode === mode}
              className={`min-h-11 rounded-full px-3 text-sm font-bold transition-colors ${
                serviceMode === mode
                  ? 'pill-ink text-(--paper)'
                  : 'text-(--graphite) hover:text-(--ink)'
              }`}
              key={mode}
              onClick={() => switchMode(mode)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {serviceMode === 'catalog' ? (
          <Field error={errors.serviceId?.message} id="serviceId" label="Select Service">
            {(id, describedBy, invalid) => (
              <Select
                aria-describedby={describedBy}
                id={id}
                invalid={invalid}
                {...serviceField}
                onChange={(event) => {
                  serviceField.onChange(event);
                  const selected = services.find((item) => item.id === event.target.value);
                  if (selected?.defaultCategoryId)
                    setValue('categoryId', selected.defaultCategoryId);
                }}
              >
                <option disabled value="">
                  Choose a service…
                </option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name} {svc.categoryName ? `(${svc.categoryName})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field
            error={errors.customServiceName?.message}
            id="customServiceName"
            label="Custom Service Name"
          >
            {(id, describedBy, invalid) => (
              <Input
                aria-describedby={describedBy}
                id={id}
                invalid={invalid}
                maxLength={120}
                placeholder="e.g. Local Gym, Private Newsletter, Cloud VPS"
                {...register('customServiceName')}
              />
            )}
          </Field>
        )}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.planName?.message} id="planName" label="Plan / Tier (Optional)">
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              maxLength={120}
              placeholder="e.g. Standard 4K, Pro, Family"
              {...register('planName')}
            />
          )}
        </Field>
        <Field error={errors.categoryId?.message} id="categoryId" label="Category">
          {(id, describedBy, invalid) => (
            <Select
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              {...register('categoryId')}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.price?.message} id="price" label="Price">
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              className="num"
              id={id}
              inputMode="decimal"
              invalid={invalid}
              min="0"
              placeholder="0.00"
              step="0.01"
              type="number"
              {...register('price')}
            />
          )}
        </Field>
        <Field
          error={errors.currencyCode?.message}
          hint="3-letter ISO code"
          id="currencyCode"
          label="Currency (ISO)"
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              className="uppercase"
              id={id}
              invalid={invalid}
              maxLength={3}
              placeholder="INR"
              {...register('currencyCode')}
            />
          )}
        </Field>
      </div>

      <Controller
        control={control}
        name="billingCycle"
        render={({ field }) => (
          <Segmented
            label="Billing Cycle"
            onChange={field.onChange}
            options={[
              { label: 'Monthly', value: 'monthly' },
              { label: 'Quarterly', value: 'quarterly' },
              { label: 'Yearly', value: 'yearly' },
            ]}
            value={field.value}
          />
        )}
      />

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <Segmented
            label="Status"
            onChange={field.onChange}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Trial', value: 'trial' },
              { label: 'Paused', value: 'paused' },
              { label: 'Cancelled', value: 'cancelled' },
            ]}
            value={field.value}
          />
        )}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field error={errors.startDate?.message} id="startDate" label="Start Date">
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              type="date"
              {...register('startDate')}
            />
          )}
        </Field>
        <Field
          action={
            <button
              className="text-xs font-bold underline underline-offset-4"
              onClick={() =>
                setValue(
                  'nextRenewalDate',
                  computeRenewalDate(getValues('startDate'), getValues('billingCycle')),
                  {
                    shouldValidate: true,
                  },
                )
              }
              type="button"
            >
              Auto-fill
            </button>
          }
          error={errors.nextRenewalDate?.message}
          hint={
            status === 'active' || status === 'trial'
              ? 'Required for active and trial subscriptions.'
              : undefined
          }
          id="nextRenewalDate"
          label="Next Renewal"
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              min={startDate || undefined}
              type="date"
              {...register('nextRenewalDate')}
            />
          )}
        </Field>
      </div>

      {status === 'trial' && (
        <Field error={errors.trialEndDate?.message} id="trialEndDate" label="Trial End Date">
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              min={startDate || undefined}
              type="date"
              {...register('trialEndDate')}
            />
          )}
        </Field>
      )}

      <Field error={errors.notes?.message} id="notes" label="Notes (Optional)">
        {(id, describedBy, invalid) => (
          <Textarea
            aria-describedby={describedBy}
            id={id}
            invalid={invalid}
            maxLength={2000}
            placeholder="Account email, special discount notes, cancellation terms…"
            {...register('notes')}
          />
        )}
      </Field>

      <div aria-live="assertive">
        <FormMessage>{apiError}</FormMessage>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-(--hairline) pt-6 sm:flex-row sm:justify-end">
        <PillLink to={cancelTo}>Cancel</PillLink>
        <Pill disabled={isSubmitting} type="submit" variant="ink">
          {isSubmitting ? submittingLabel : submitLabel}
        </Pill>
      </div>
    </form>
  );
}
