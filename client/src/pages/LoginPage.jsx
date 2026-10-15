import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';
import AuthCard from '../components/AuthCard.jsx';
import PasswordField from '../components/PasswordField.jsx';

function LoginPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(form);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard description="Use your private SpendWise account to continue." title="Welcome back">
      <form className="space-y-5" onSubmit={submit}>
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
          autoComplete="current-password"
          label="Password"
          name="password"
          onChange={updateField}
          value={form.password}
        />
        {error && <p className="rounded-xl bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        <button
          className="w-full rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        New to SpendWise?{' '}
        <Link className="font-bold text-emerald-300" to="/register">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export default LoginPage;
