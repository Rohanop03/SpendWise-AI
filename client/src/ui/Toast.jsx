import { Toast as RadixToast } from 'radix-ui';
import { useCallback, useMemo, useState } from 'react';

import Icon from './Icon.jsx';
import { ToastContext } from './toastContext.js';

let toastId = 0;

/**
 * Designed toasts replace browser alerts. Errors are obsidian, confirmations are glass;
 * both carry an icon and a text label, never colour alone.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((message, { description, tone = 'success' } = {}) => {
    toastId += 1;
    setToasts((current) => [...current.slice(-2), { description, id: toastId, message, tone }]);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider duration={5000} swipeDirection="down">
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            className={`toast-root flex items-start gap-3 rounded-2xl p-4 pr-3 ${
              toast.tone === 'error' ? 'obsidian' : 'glass glass-solid'
            }`}
            key={toast.id}
            onOpenChange={(open) => {
              if (!open) setToasts((current) => current.filter((item) => item.id !== toast.id));
            }}
            type={toast.tone === 'error' ? 'foreground' : 'background'}
          >
            <Icon
              className="mt-0.5 size-5 shrink-0"
              name={toast.tone === 'error' ? 'alert' : 'check'}
            />
            <div className="min-w-0 flex-1">
              <RadixToast.Title className="text-sm font-bold leading-5">
                <span className="sr-only">{toast.tone === 'error' ? 'Error: ' : 'Done: '}</span>
                {toast.message}
              </RadixToast.Title>
              {toast.description && (
                <RadixToast.Description className="mt-1 text-sm leading-5 opacity-80">
                  {toast.description}
                </RadixToast.Description>
              )}
            </div>
            <RadixToast.Close
              aria-label="Dismiss notification"
              className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5"
            >
              <Icon className="size-4" name="close" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-[calc(var(--dock-height)+1rem+env(safe-area-inset-bottom))] left-1/2 z-[80] flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 outline-none md:bottom-6 md:left-auto md:right-6 md:translate-x-0" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
