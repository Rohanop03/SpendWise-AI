import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { updateProfile } from '../api/account.js';
import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';
import { profileSchema } from '../forms/schemas.js';
import { initials, pageIndex } from '../layout/nav.js';
import { ConfirmDialog } from '../ui/Dialog.jsx';
import { Field, FormMessage, Input } from '../ui/Field.jsx';
import { Notice } from '../ui/Feedback.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { Pill, PillLink } from '../ui/Pill.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { formatDate } from '../utils/dates.js';

function AccountPage() {
  const { logout, setUser, user } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState({ text: '', tone: 'success' });
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({
    defaultValues: { name: user.name },
    resolver: zodResolver(profileSchema),
  });

  async function submit(values) {
    setMessage({ text: '', tone: 'success' });
    try {
      const updatedUser = await updateProfile({ name: values.name });
      setUser(updatedUser);
      setMessage({ text: 'Profile updated.', tone: 'success' });
    } catch (error) {
      setMessage({ text: getApiErrorMessage(error), tone: 'error' });
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    navigate('/', { replace: true });
    await logout();
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        description="Your display name and sign-in identity."
        index={pageIndex('/account')}
        title="Account profile"
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader title="Profile" />
          <form className="space-y-5" noValidate onSubmit={handleSubmit(submit)}>
            <Field error={errors.name?.message} label="Name">
              {(id, describedBy, invalid) => (
                <Input
                  aria-describedby={describedBy}
                  id={id}
                  invalid={invalid}
                  maxLength={100}
                  {...register('name')}
                />
              )}
            </Field>
            <Field hint="Email cannot be changed here." label="Email">
              {(id, describedBy) => (
                <Input aria-describedby={describedBy} disabled id={id} value={user.email} />
              )}
            </Field>
            {message.tone === 'success' ? (
              <Notice>{message.text}</Notice>
            ) : (
              <FormMessage>{message.text}</FormMessage>
            )}
            <Pill disabled={isSubmitting} type="submit" variant="ink">
              {isSubmitting ? 'Saving…' : 'Save profile'}
            </Pill>
          </form>
        </Card>

        <div className="space-y-6 lg:col-span-5">
          <Card delay={0.05} look="obsidian">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="pill-paper grid size-14 shrink-0 place-items-center rounded-full text-lg font-bold"
              >
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{user.name}</p>
                <p className="truncate text-sm text-soft">{user.email}</p>
              </div>
            </div>
            {user.createdAt && (
              <p className="mt-5 text-sm text-soft">
                Member since {formatDate(user.createdAt, 'MMMM YYYY')}
              </p>
            )}
          </Card>
          <Card delay={0.1}>
            <CardHeader
              description="Configure reminders, display preferences, and password security from settings."
              title="Account controls"
            />
            <div className="flex flex-wrap gap-3">
              <PillLink icon="settings" to="/settings">
                Open settings
              </PillLink>
              <Pill icon="logout" onClick={() => setConfirmLogout(true)} variant="outline">
                Log out of this device
              </Pill>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        busy={loggingOut}
        busyLabel="Logging out…"
        confirmLabel="Log out"
        description="Your session on this browser is revoked on the server. Your records stay saved; sign in again any time."
        onConfirm={handleLogout}
        onOpenChange={setConfirmLogout}
        open={confirmLogout}
        title="Log out of SpendWise AI?"
      />
    </div>
  );
}

export default AccountPage;
