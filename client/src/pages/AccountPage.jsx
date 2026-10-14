import { useState } from 'react';
import { Link } from 'react-router-dom';

import { updateProfile } from '../api/account.js';
import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';

function AccountPage() {
  const { setUser, user } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setMessage('');
    setSaving(true);

    try {
      const updatedUser = await updateProfile({ displayName });
      setUser(updatedUser);
      setMessage('Profile updated.');
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Your account</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-white">Account profile</h1>
      <div className="mt-9 grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <form className="rounded-3xl border border-white/10 bg-white/[0.055] p-7" onSubmit={submit}>
          <label className="block text-sm font-semibold text-slate-200">
            Display name
            <input
              className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 text-white outline-none focus:border-emerald-300"
              maxLength={100}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </label>
          <label className="mt-5 block text-sm font-semibold text-slate-400">
            Email
            <input
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-400"
              disabled
              value={user.email}
            />
          </label>
          {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
          <button
            className="mt-6 rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950 disabled:opacity-60"
            disabled={saving}
            type="submit"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
        <aside className="rounded-3xl border border-white/10 bg-slate-900/70 p-7">
          <h2 className="text-xl font-bold text-white">Account controls</h2>
          <p className="mt-3 leading-7 text-slate-400">
            Configure reminders, display preferences, and password security from settings.
          </p>
          <Link className="mt-6 inline-flex font-bold text-emerald-300" to="/settings">
            Open settings →
          </Link>
        </aside>
      </div>
    </section>
  );
}

export default AccountPage;
