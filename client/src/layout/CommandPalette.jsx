import { Dialog as RadixDialog } from 'radix-ui';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getSubscriptions } from '../api/subscriptions.js';
import Icon from '../ui/Icon.jsx';
import { useReturnFocus } from '../ui/useReturnFocus.js';
import { navItems } from './nav.js';

const actions = [
  { icon: 'plus', label: 'Add subscription', to: '/subscriptions/new' },
  { icon: 'receipt', label: 'Record payment', to: '/payments/new' },
];

/**
 * ⌘K / Ctrl+K "jump to" (the shortcut listener lives in AppLayout; this module is lazy): pages, quick actions, and subscriptions matched by name via the
 * existing `GET /subscriptions?search=` endpoint.
 */
export default function CommandPalette({ onOpenChange, open }) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const onCloseAutoFocus = useReturnFocus(open);

  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) return undefined;
    let current = true;
    const timer = setTimeout(() => {
      setSearching(true);
      getSubscriptions({ archived: 'false', limit: 6, search: term })
        .then((data) => current && setMatches(data.items || []))
        .catch(() => current && setMatches([]))
        .finally(() => current && setSearching(false));
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    const pages = [...actions, ...navItems.map((item) => ({ ...item, label: item.label }))]
      .filter((item) => !term || item.label.toLowerCase().includes(term))
      .map((item) => ({ ...item, group: item.index ? 'Pages' : 'Actions' }));
    const subs =
      term.length >= 2
        ? matches.map((item) => ({
            group: 'Subscriptions',
            icon: 'stack',
            label: item.serviceName,
            meta: item.planName,
            to: `/subscriptions/${item.id}`,
          }))
        : [];
    return [...pages, ...subs];
  }, [matches, query]);

  function close() {
    onOpenChange(false);
    setQuery('');
    setActive(0);
    setMatches([]);
  }

  function go(item) {
    if (!item) return;
    close();
    navigate(item.to);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(items.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(items[active]);
    }
  }

  const activeId = items[active] ? `${listId}-${active}` : undefined;

  return (
    <RadixDialog.Root onOpenChange={(value) => (value ? onOpenChange(true) : close())} open={open}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay fixed inset-0 z-[60] bg-[rgb(12_12_14/24%)]" />
        <RadixDialog.Content
          className="dialog-content glass glass-solid fixed left-1/2 top-[10dvh] z-[61] w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[1.75rem] p-2"
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <RadixDialog.Title className="sr-only">Jump to a page or subscription</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Type to filter pages and search your subscriptions. Use the arrow keys and Enter.
          </RadixDialog.Description>
          <div className="well flex items-center gap-3 !rounded-[1.3rem] !py-1">
            <Icon className="size-5 shrink-0 text-(--graphite)" name="search" />
            <input
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded="true"
              aria-label="Search pages and subscriptions"
              className="min-w-0 flex-1 bg-transparent py-2.5 outline-none"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Jump to… (try “Netflix” or “Payments”)"
              ref={inputRef}
              role="combobox"
              value={query}
            />
            <kbd className="num hidden rounded-md border border-(--hairline-strong) px-1.5 py-0.5 text-[10px] sm:block">
              ESC
            </kbd>
          </div>
          <ul className="mt-2 max-h-[55dvh] overflow-y-auto p-1" id={listId} role="listbox">
            {items.map((item, index) => (
              <li
                aria-selected={index === active}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm ${
                  index === active ? 'pill-ink text-(--paper)' : 'hover:bg-white/60'
                }`}
                id={`${listId}-${index}`}
                key={`${item.group}-${item.to}`}
                onClick={() => go(item)}
                onMouseMove={() => setActive(index)}
                role="option"
              >
                <Icon className="size-4 shrink-0" name={item.icon} />
                <span className="min-w-0 flex-1 truncate font-bold">
                  {item.label}
                  {item.meta && <span className="font-normal opacity-70"> · {item.meta}</span>}
                </span>
                <span className="eyebrow !text-[0.62rem] opacity-70 [.pill-ink_&]:text-(--on-ink-soft)">
                  {item.group}
                </span>
              </li>
            ))}
            {!items.length && (
              <li className="px-3 py-6 text-center text-sm text-(--graphite)" role="presentation">
                {searching ? 'Searching…' : 'Nothing matches that search.'}
              </li>
            )}
          </ul>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
