import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getPreferences, updatePreferences } from '../api/account.js';
import { changePassword } from '../api/auth.js';
import { getApiErrorMessage } from '../api/http.js';
import { useAuth } from '../auth/useAuth.js';
import PasswordField from '../components/PasswordField.jsx';

function SettingsPage() {
  const { clearAuthentication } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    getPreferences()
      .then(setPreferences)
      .catch((error) => setMessage(getApiErrorMessage(error)))
      .finally(() => setLoading(false));
  }, []);

  function updatePreference(event) {
    const { checked, name, type, value } = event.target;
    setPreferences((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  }

  async function savePreferences(event) {
    event.preventDefault();
    setMessage('');

    try {
      const updated = await updatePreferences({
        notificationsEnabled: preferences.notificationsEnabled,
        preferredCurrency: preferences.preferredCurrency,
        renewalReminderDays: preferences.renewalReminderDays,
        renewalRemindersEnabled: preferences.renewalRemindersEnabled,
        timezone: preferences.timezone,
        trialReminderDays: preferences.trialReminderDays,
        trialRemindersEnabled: preferences.trialRemindersEnabled,
      });
      setPreferences(updated);
      setMessage('Preferences updated.');
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    setMessage('');

    try {
      await changePassword(passwords);
      clearAuthentication();
      navigate('/login', { replace: true, state: { passwordChanged: true } });
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    }
  }

  if (loading) {
    return <p className="px-5 py-24 text-center text-slate-300">Loading preferences…</p>;
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
        Account settings
      </p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
        Preferences and security
      </h1>
      {message && (
        <p className="mt-6 rounded-xl bg-white/5 p-4 text-sm text-slate-200">{message}</p>
      )}
      <div className="mt-9 grid gap-6 lg:grid-cols-2">
        {preferences && (
          <form
            className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.055] p-7"
            onSubmit={savePreferences}
          >
            <h2 className="text-xl font-bold text-white">Preferences</h2>
            <label className="block text-sm font-semibold text-slate-200">
              Preferred currency
              <input
                className="form-input"
                maxLength={3}
                name="preferredCurrency"
                onChange={updatePreference}
                pattern="[A-Z]{3}"
                required
                value={preferences.preferredCurrency}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              IANA timezone
              <input
                className="form-input"
                name="timezone"
                onChange={updatePreference}
                required
                value={preferences.timezone}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Renewal reminder days
              <input
                className="form-input"
                max="365"
                min="0"
                name="renewalReminderDays"
                onChange={updatePreference}
                type="number"
                value={preferences.renewalReminderDays}
              />
            </label>
            <label className="block text-sm font-semibold text-slate-200">
              Trial reminder days
              <input
                className="form-input"
                max="365"
                min="0"
                name="trialReminderDays"
                onChange={updatePreference}
                type="number"
                value={preferences.trialReminderDays}
              />
            </label>
            {[
              ['notificationsEnabled', 'Enable in-app notifications'],
              ['renewalRemindersEnabled', 'Enable renewal reminders'],
              ['trialRemindersEnabled', 'Enable trial reminders'],
            ].map(([name, label]) => (
              <label className="flex items-center gap-3 text-sm text-slate-200" key={name}>
                <input
                  checked={preferences[name]}
                  name={name}
                  onChange={updatePreference}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
            <button
              className="rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950"
              type="submit"
            >
              Save preferences
            </button>
          </form>
        )}
        <form
          className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.055] p-7"
          onSubmit={submitPassword}
        >
          <h2 className="text-xl font-bold text-white">Change password</h2>
          <p className="text-sm leading-6 text-slate-400">
            Changing your password signs out every active session, including this browser.
          </p>
          <PasswordField
            autoComplete="current-password"
            label="Current password"
            name="currentPassword"
            onChange={(event) =>
              setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
            }
            value={passwords.currentPassword}
          />
          <PasswordField
            autoComplete="new-password"
            label="New password"
            name="newPassword"
            onChange={(event) =>
              setPasswords((current) => ({ ...current, newPassword: event.target.value }))
            }
            value={passwords.newPassword}
          />
          <button
            className="rounded-xl border border-emerald-300/50 px-5 py-3 font-bold text-emerald-200"
            type="submit"
          >
            Change password
          </button>
        </form>
      </div>
    </section>
  );
}

export default SettingsPage;
