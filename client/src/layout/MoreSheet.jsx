import { NavLink } from 'react-router-dom';

import { Dialog } from '../ui/Dialog.jsx';
import Icon from '../ui/Icon.jsx';
import { Pill } from '../ui/Pill.jsx';
import { initials } from './nav.js';

/** Mobile "More" sheet: the pages that don't fit in the dock, plus logout. Lazy-loaded. */
export default function MoreSheet({ items, onLogout, onOpenChange, open, user }) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open} title="More">
      <ul className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              className={({ isActive }) =>
                `flex min-h-14 items-center gap-3 rounded-2xl px-4 text-sm font-bold ${
                  isActive ? 'pill-ink text-(--paper)' : 'neu-raised depth-1'
                }`
              }
              onClick={() => onOpenChange(false)}
              to={item.to}
            >
              <Icon className="size-5 shrink-0" name={item.icon} />
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-(--hairline) pt-5">
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="neu-raised depth-1 grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
          >
            {initials(user?.name)}
          </span>
          <span className="truncate text-sm font-bold">{user?.name}</span>
        </span>
        <Pill
          icon="logout"
          onClick={() => {
            onOpenChange(false);
            onLogout();
          }}
          size="sm"
          variant="outline"
        >
          Log out
        </Pill>
      </div>
    </Dialog>
  );
}
