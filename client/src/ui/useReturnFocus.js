import { useLayoutEffect, useRef } from 'react';

/**
 * Controlled Radix dialogs have no Dialog.Trigger, so Radix cannot return focus on close.
 * Remember what was focused when the dialog opened and hand it back via onCloseAutoFocus.
 */
export function useReturnFocus(open) {
  const returnTo = useRef(null);
  useLayoutEffect(() => {
    if (open && typeof document !== 'undefined') returnTo.current = document.activeElement;
  }, [open]);
  return (event) => {
    event.preventDefault();
    const target = returnTo.current;
    if (target && target.isConnected && typeof target.focus === 'function') target.focus();
  };
}
