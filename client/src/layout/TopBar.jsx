import { useLocation } from 'react-router-dom';

import Icon from '../ui/Icon.jsx';
import { PillLink } from '../ui/Pill.jsx';
import { todayIso, todayLabel } from '../utils/dates.js';
import { BrandGlyph } from './BrandMark.jsx';
import { sectionFor } from './nav.js';
import NotificationBell from './NotificationBell.jsx';

/** Sticky glass top bar: section title, ⌘K jump pill, today's date, bell, primary action. */
export default function TopBar({ onOpenPalette }) {
  const { pathname } = useLocation();
  const section = sectionFor(pathname);

  return (
    <header className="glass sticky top-0 z-30 flex items-center gap-2 rounded-b-[1.4rem] border-x-0 border-t-0 px-3 py-2.5 sm:gap-3 sm:px-5 md:top-(--console-inset) md:mx-3 md:mt-3 md:rounded-[1.4rem] md:border lg:px-6">
      <span className="md:hidden">
        <BrandGlyph className="size-9" />
      </span>
      <p className="min-w-0 flex-1 truncate">
        {section && <span className="eyebrow mr-2 hidden sm:inline">{section.index}</span>}
        <span className="text-base font-bold">{section?.label || 'SpendWise AI'}</span>
      </p>

      <button
        aria-keyshortcuts="Control+K Meta+K"
        className="pill neu-press hidden min-w-[13rem] justify-start !font-normal text-(--graphite) lg:inline-flex"
        onClick={onOpenPalette}
        type="button"
      >
        <Icon className="size-4" name="search" />
        <span className="flex-1 text-left text-sm">Jump to…</span>
        <kbd className="num rounded-md border border-(--hairline-strong) px-1.5 py-0.5 text-[10px]">
          Ctrl K
        </kbd>
      </button>
      <button
        aria-label="Jump to a page or subscription"
        className="pill neu-press size-11 !p-0 lg:hidden"
        onClick={onOpenPalette}
        type="button"
      >
        <Icon name="search" />
      </button>

      <p className="neu-pressed depth-1 hidden items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold xl:flex">
        <Icon className="size-4" name="calendar" />
        <time dateTime={todayIso()}>{todayLabel()}</time>
      </p>

      <NotificationBell />

      <PillLink className="hidden sm:inline-flex" icon="plus" to="/subscriptions/new" variant="ink">
        Add subscription
      </PillLink>
    </header>
  );
}
