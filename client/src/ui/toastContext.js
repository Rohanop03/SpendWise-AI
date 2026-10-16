import { createContext, useContext } from 'react';

export const ToastContext = createContext({ notify: () => {} });

/** `notify(message, { description, tone: 'success' | 'error' })` */
export function useToast() {
  return useContext(ToastContext);
}
