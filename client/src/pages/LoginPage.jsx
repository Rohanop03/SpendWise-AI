import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';
import AuthCard from '../components/AuthCard.jsx';
import { emailRules, loginPasswordRules } from '../forms/authRules.js';
import { publicPages } from '../seo/meta.js';
import Seo from '../seo/Seo.jsx';
import { Field, FormMessage, Input, PasswordInput } from '../ui/Field.jsx';
import { Pill } from '../ui/Pill.jsx';

function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({ defaultValues: { email: '', password: '' } });

  async function submit(values) {
    setError('');
    try {
      // Same payload as before: { email, password } exactly as typed.
      await login({ email: values.email, password: values.password });
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  return (
    <>
      <Seo
        description={publicPages['/login'].description}
        path="/login"
        title={publicPages['/login'].title}
      />
      <AuthCard
        description="Use your private SpendWise account to continue."
        footer={
          <>
            New to SpendWise?{' '}
            <Link className="font-bold text-(--ink) underline underline-offset-4" to="/register">
              Create an account
            </Link>
          </>
        }
        title="Welcome back"
      >
        <form className="space-y-5" noValidate onSubmit={handleSubmit(submit)}>
          <Field error={errors.email?.message} label="Email">
            {(id, describedBy, invalid) => (
              <Input
                aria-describedby={describedBy}
                autoComplete="email"
                id={id}
                invalid={invalid}
                inputMode="email"
                type="email"
                {...register('email', emailRules)}
              />
            )}
          </Field>
          <Field error={errors.password?.message} label="Password">
            {(id, describedBy, invalid) => (
              <PasswordInput
                aria-describedby={describedBy}
                autoComplete="current-password"
                id={id}
                invalid={invalid}
                label="Password"
                {...register('password', loginPasswordRules)}
              />
            )}
          </Field>
          <div aria-live="assertive">
            <FormMessage>{error}</FormMessage>
          </div>
          <Pill className="w-full" disabled={isSubmitting} type="submit" variant="ink">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Pill>
        </form>
      </AuthCard>
    </>
  );
}

export default LoginPage;
