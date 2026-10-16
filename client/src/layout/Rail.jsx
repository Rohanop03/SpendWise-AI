import { motion } from 'framer-motion';
import { Link, NavLink } from 'react-router-dom';

import Icon from '../ui/Icon.jsx';
import { pressSpring } from '../ui/motion.js';
import BrandMark, { BrandGlyph } from './BrandMark.jsx';
import { initials, navItems } from './nav.js';

/**
 * Desktop rail: slim neumorphic column. The current item is an obsidian pill; every other
 * item is raised. Labels are always present in the accessible name.
 */
export default function Rail({ onLogout, user }) {
  return (
    <aside className="sticky top-(--console-inset) hidden h-[calc(100dvh-2*var(--console-inset))] w-[5.75rem] shrink-0 flex-col items-stretch border-r border-(--hairline) px-2.5 py-5 md:flex xl:w-[15rem] xl:px-4">
      <Link
        aria-label="SpendWise AI home"
        className="mx-auto mb-7 rounded-2xl xl:mx-0 xl:px-1"
        to="/dashboard"
      >
        <span className="xl:hidden">
          <BrandGlyph />
        </span>
        <span className="hidden xl:block">
          <BrandMark />
        </span>
      </Link>

      <nav
        aria-label="Primary navigation"
        className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1 py-1"
      >
        <ul className="grid gap-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink className="group block rounded-2xl" to={item.to}>
                {({ isActive }) => (
                  <motion.span
                    className={`relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[0.68rem] font-bold leading-none transition-colors xl:flex-row xl:justify-start xl:gap-3 xl:px-3.5 xl:text-[0.88rem] ${
                      isActive
                        ? 'pill-ink text-(--paper)'
                        : 'text-(--graphite) group-hover:bg-white/50 group-hover:text-(--ink)'
                    }`}
                    transition={pressSpring}
                    whileTap={{ scale: 0.96 }}
                  >
                    <Icon className="size-5 shrink-0" name={item.icon} />
                    <span className="max-w-full truncate">{item.label}</span>
                  </motion.span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 border-t border-(--hairline) pt-4">
        <div className="flex flex-col items-center gap-3 xl:flex-row xl:items-center">
          <span
            aria-hidden="true"
            className="neu-raised depth-1 grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold"
          >
            {initials(user?.displayName)}
          </span>
          <span className="hidden min-w-0 flex-1 xl:block">
            <span className="block truncate text-sm font-bold">{user?.displayName}</span>
            <span className="block truncate text-xs text-(--graphite)">{user?.email}</span>
          </span>
        </div>
        <button
          className="pill pill-outline pill-sm mt-3 w-full !px-2"
          onClick={onLogout}
          type="button"
        >
          <Icon className="size-4 shrink-0" name="logout" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
