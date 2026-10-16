import { zodResolver } from '@hookform/resolvers/zod';
import { Switch } from 'radix-ui';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { getPreferences, updatePreferences } from '../api/account.js';
import { changePassword } from '../api/auth.js';
import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';
import { changePasswordSchema, preferencesSchema } from '../forms/schemas.js';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, Notice } from '../ui/Feedback.jsx';
import { Field, FormMessage, Input, PasswordInput } from '../ui/Field.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { Pill } from '../ui/Pill.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';

const toggles = [
  ['notificationsEnabled', 'Enable in-app notifications'],
  ['renewalRemindersEnabled', 'Enable renewal reminders'],
  ['trialRemindersEnabled', 'Enable trial reminders'],
];

/** Neumorphic switch: pressed + ink thumb when on, with a text state for non-visual users. */
function PreferenceSwitch({ checked, id, label, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label className="text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      <Switch.Root
        checked={checked}
        className="neu-press relative inline-flex h-8 w-14 shrink-0 items-center rounded-full"
        id={id}
        onCheckedChange={onChange}
      >
        <Switch.Thumb
          className={`block size-6 rounded-full transition-transform duration-200 ${
            checked ? 'pill-ink translate-x-7' : 'neu-raised depth-1 translate-x-1'
          }`}
        />
      </Switch.Root>
    </div>
  );
}

function PreferencesForm({ initial }) {
  const [message, setMessage] = useState({ text: '', tone: 'success' });
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm({ defaultValues: initial, resolver: zodResolver(preferencesSchema) });

  async function save(values) {
    setMessage({ text: '', tone: 'success' });
    try {
      const updated = await updatePreferences({
        notificationsEnabled: values.notificationsEnabled,
        preferredCurrency: values.preferredCurrency,
        renewalReminderDays: values.renewalReminderDays,
        renewalRemindersEnabled: values.renewalRemindersEnabled,
        timezone: values.timezone,
        trialReminderDays: values.trialReminderDays,
        trialRemindersEnabled: values.trialRemindersEnabled,
      });
      reset(updated);
      setMessage({ text: 'Preferences updated.', tone: 'success' });
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error), tone: 'error' });
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(save)}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          error={errors.preferredCurrency?.message}
          hint="3-letter ISO code"
          label="Preferred currency"
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              className="uppercase"
              id={id}
              invalid={invalid}
              maxLength={3}
              {...register('preferredCurrency', { setValueAs: (value) => value.toUpperCase() })}
            />
          )}
        </Field>
        <Field
          error={errors.timezone?.message}
          hint="For example Asia/Kolkata"
          label="IANA timezone"
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              invalid={invalid}
              {...register('timezone')}
            />
          )}
        </Field>
        <Field
          error={errors.renewalReminderDays?.message}
          hint="0–365 days before renewal"
          label="Renewal reminder days"
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              inputMode="numeric"
              invalid={invalid}
              max="365"
              min="0"
              type="number"
              {...register('renewalReminderDays', { valueAsNumber: true })}
            />
          )}
        </Field>
        <Field
          error={errors.trialReminderDays?.message}
          hint="0–365 days before a trial ends"
          label="Trial reminder days"
        >
          {(id, describedBy, invalid) => (
            <Input
              aria-describedby={describedBy}
              id={id}
              inputMode="numeric"
              invalid={invalid}
              max="365"
              min="0"
              type="number"
              {...register('trialReminderDays', { valueAsNumber: true })}
            />
          )}
        </Field>
      </div>
      <div className="neu-pressed depth-1 divide-y divide-(--hairline) rounded-2xl px-4 py-1">
        {toggles.map(([name, label]) => (
          <Controller
            control={control}
            key={name}
            name={name}
            render={({ field }) => (
              <PreferenceSwitch
                checked={field.value}
                id={`pref-${name}`}
                label={label}
                onChange={field.onChange}
              />
            )}
          />
        ))}
      </div>
      {message.tone === 'success' ? (
        <Notice>{message.text}</Notice>
      ) : (
        <FormMessage>{message.text}</FormMessage>
      )}
      <Pill disabled={isSubmitting} type="submit" variant="ink">
        {isSubmitting ? 'Saving…' : 'Save preferences'}
      </Pill>
    </form>
  );
}

function PasswordForm() {
  const { clearAuthentication } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({
    defaultValues: { currentPassword: '', newPassword: '' },
    resolver: zodResolver(changePasswordSchema),
  });

  async function submit(values) {
    setError('');
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      clearAuthentication();
      navigate('/login', { replace: true, state: { passwordChanged: true } });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit(submit)}>
      <Field error={errors.currentPassword?.message} label="Current password">
        {(id, describedBy, invalid) => (
          <PasswordInput
            aria-describedby={describedBy}
            autoComplete="current-password"
            id={id}
            invalid={invalid}
            label="Current password"
            {...register('currentPassword')}
          />
        )}
      </Field>
      <Field
        error={errors.newPassword?.message}
        hint="At least 12 characters, no more than 72 UTF-8 bytes."
        label="New password"
      >
        {(id, describedBy, invalid) => (
          <PasswordInput
            aria-describedby={describedBy}
            autoComplete="new-password"
            id={id}
            invalid={invalid}
            label="New password"
            {...register('newPassword')}
          />
        )}
      </Field>
      <FormMessage>{error}</FormMessage>
      <Pill disabled={isSubmitting} type="submit" variant="outline">
        {isSubmitting ? 'Changing…' : 'Change password'}
      </Pill>
    </form>
  );
}

function SettingsPage() {
  const [state, setState] = useState({ error: '', loading: true, preferences: null });

  useEffect(() => {
    getPreferences()
      .then((preferences) => setState({ error: '', loading: false, preferences }))
      .catch((error) =>
        setState({ error: getApiErrorMessage(error), loading: false, preferences: null }),
      );
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        description="Reminder lead times, display currency, timezone and password security."
        index={pageIndex('/settings')}
        title="Preferences and security"
      />
      {state.error && (
        <div className="mb-6">
          <FormMessage>{state.error}</FormMessage>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader
            description="Reminders are generated from these settings by the background worker."
            title="Preferences"
          />
          {state.loading ? (
            <CardSkeleton label="preferences" lines={4} />
          ) : (
            state.preferences && <PreferencesForm initial={state.preferences} />
          )}
        </Card>
        <Card className="lg:col-span-5" delay={0.05}>
          <CardHeader
            description="Changing your password signs out every active session, including this browser."
            title="Change password"
          />
          <PasswordForm />
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;
