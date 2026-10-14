import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';
import AuthCard from '../components/AuthCard.jsx';
import PasswordField from '../components/PasswordField.jsx';

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    confirmPassword: '',
    displayName: '',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await register({
        displayName: form.displayName,
        email: form.email,
        password: form.password,
      });
      navigate('/account', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      description="Create a private account. Your password is hashed before it reaches storage."
      title="Create your account"
    >
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-semibold text-slate-200">
          Display name
          <input
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-emerald-300"
            maxLength={100}
            name="displayName"
            onChange={updateField}
            required
            value={form.displayName}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-200">
          Email
          <input
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-emerald-300"
            name="email"
            onChange={updateField}
            required
            type="email"
            value={form.email}
          />
        </label>
        <PasswordField
          autoComplete="new-password"
          label="Password"
          name="password"
          onChange={updateField}
          value={form.password}
        />
        <p className="-mt-3 text-xs text-slate-500">
          Use at least 12 characters and no more than 72 UTF-8 bytes.
        </p>
        <PasswordField
          autoComplete="new-password"
          label="Confirm password"
          name="confirmPassword"
          onChange={updateField}
          value={form.confirmPassword}
        />
        {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        <button
          className="w-full rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        Already registered?{' '}
        <Link className="font-bold text-emerald-300" to="/login">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default RegisterPage;
