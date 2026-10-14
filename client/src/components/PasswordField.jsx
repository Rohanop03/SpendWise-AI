import { useState } from 'react';

function PasswordField({ autoComplete, label, name, onChange, value }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-sm font-semibold text-slate-200">
      {label}
      <span className="mt-2 flex rounded-xl border border-white/15 bg-slate-950/60 focus-within:border-emerald-300">
        <input
          autoComplete={autoComplete}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white outline-none"
          name={name}
          onChange={onChange}
          required
          type={visible ? 'text' : 'password'}
          value={value}
        />
        <button
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          className="px-4 text-xs font-bold text-emerald-300"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </span>
    </label>
  );
}

export default PasswordField;
