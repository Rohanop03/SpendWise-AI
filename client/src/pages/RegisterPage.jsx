import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';
import AuthCard from '../components/AuthCard.jsx';
import {
  confirmPasswordRules,
  displayNameRules,
  emailRules,
  newPasswordRules,
} from '../forms/authRules.js';
import { publicPages } from '../seo/meta.js';
import Seo from '../seo/Seo.jsx';
import { Field, FormMessage, Input, PasswordInput } from '../ui/Field.jsx';
import { Pill } from '../ui/Pill.jsx';

function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerAccount } = useAuth();
  const [error, setError] = useState('');
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
  } = useForm({ defaultValues: { confirmPassword: '', displayName: '', email: '', password: '' } });

  async function submit(values) {
    setError('');
    try {
      await registerAccount({
        displayName: values.displayName,
        email: values.email,
        password: values.password,
      });
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      // Duplicate email and other API errors surface verbatim from the API message.
      setError(getApiErrorMessage(requestError));
    }
  }

  return (
    <>
      <Seo
        description={publicPages['/register'].description}
        path="/register"
        title={publicPages['/register'].title}
      />
      <AuthCard
        description="Create a private account. Your password is hashed before it reaches storage."
        footer={
          <>
            Already registered?{' '}
            <Link className="font-bold text-(--ink) underline underline-offset-4" to="/login">
              Sign in
            </Link>
          </>
        }
        title="Create your account"
      >
        <form className="space-y-5" noValidate onSubmit={handleSubmit(submit)}>
          <Field error={errors.displayName?.message} label="Display name">
            {(id, describedBy, invalid) => (
              <Input
                aria-describedby={describedBy}
                autoComplete="name"
                id={id}
                invalid={invalid}
                maxLength={100}
                {...register('displayName', displayNameRules)}
              />
            )}
          </Field>
          <Field error={errors.email?.message} label="Email">
            {(id, describedBy, invalid) => (
              <Input
                aria-describedby={describedBy}
                autoComplete="email"
                id={id}
                inputMode="email"
                invalid={invalid}
                type="email"
                {...register('email', emailRules)}
              />
            )}
          </Field>
          <Field
            error={errors.password?.message}
            hint="Use at least 12 characters and no more than 72 UTF-8 bytes."
            label="Password"
          >
            {(id, describedBy, invalid) => (
              <PasswordInput
                aria-describedby={describedBy}
                autoComplete="new-password"
                id={id}
                invalid={invalid}
                label="Password"
                {...register('password', newPasswordRules)}
              />
            )}
          </Field>
          <Field error={errors.confirmPassword?.message} label="Confirm password">
            {(id, describedBy, invalid) => (
              <PasswordInput
                aria-describedby={describedBy}
                autoComplete="new-password"
                id={id}
                invalid={invalid}
                label="Confirm password"
                {...register(
                  'confirmPassword',
                  confirmPasswordRules(() => getValues('password')),
                )}
              />
            )}
          </Field>
          <div aria-live="assertive">
            <FormMessage>{error}</FormMessage>
          </div>
          <Pill className="w-full" disabled={isSubmitting} type="submit" variant="ink">
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Pill>
        </form>
      </AuthCard>
    </>
  );
}

export default RegisterPage;
