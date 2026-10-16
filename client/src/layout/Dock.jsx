import { motion } from 'framer-motion';
import { lazy, Suspense, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import Icon from '../ui/Icon.jsx';
import { pressSpring } from '../ui/motion.js';
import { dockPaths, navItems } from './nav.js';

const MoreSheet = lazy(() => import('./MoreSheet.jsx'));

/** Mobile bottom glass dock (under 768px) with a "More" sheet for the remaining pages. */
export default function Dock({ onLogout, user }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreLoaded, setMoreLoaded] = useState(false);
  const { pathname } = useLocation();
  const pinned = navItems.filter((item) => dockPaths.includes(item.to));
  const rest = navItems.filter((item) => !dockPaths.includes(item.to));
  const moreActive = rest.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="glass fixed inset-x-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 rounded-[1.6rem] p-1.5 md:hidden"
      >
        <ul className="grid grid-cols-5 gap-1">
          {pinned.map((item) => (
            <li key={item.to}>
              <DockLink item={item} />
            </li>
          ))}
          <li>
            <motion.button
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-[1.2rem] text-[0.68rem] font-bold ${
                moreActive ? 'pill-ink text-(--paper)' : 'text-(--graphite)'
              }`}
              onClick={() => {
                setMoreLoaded(true);
                setMoreOpen(true);
              }}
              transition={pressSpring}
              type="button"
              whileTap={{ scale: 0.94 }}
            >
              <Icon className="size-5" name="more" strokeWidth={2.4} />
              More
            </motion.button>
          </li>
        </ul>
      </nav>

      {moreLoaded && (
        <Suspense fallback={null}>
          <MoreSheet
            onLogout={onLogout}
            onOpenChange={setMoreOpen}
            open={moreOpen}
            items={rest}
            user={user}
          />
        </Suspense>
      )}
    </>
  );
}

function DockLink({ item }) {
  return (
    <NavLink
      aria-label={item.short ? item.label : undefined}
      className="block rounded-[1.2rem]"
      to={item.to}
    >
      {({ isActive }) => (
        <motion.span
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.2rem] px-1 text-[0.68rem] font-bold ${
            isActive ? 'pill-ink text-(--paper)' : 'text-(--graphite)'
          }`}
          transition={pressSpring}
          whileTap={{ scale: 0.94 }}
        >
          <Icon className="size-5" name={item.icon} />
          <span className="max-w-full truncate">{item.short || item.label}</span>
        </motion.span>
      )}
    </NavLink>
  );
}
