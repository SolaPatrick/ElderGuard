import { createContext, use } from 'react';

/** SH-08: a short message at the bottom of the screen after something is done. */
export interface Toast {
  message: string;
  /** success and info close after 5 seconds; error stays until closed. */
  severity?: 'success' | 'info' | 'error';
  action?: { label: string; onClick: () => void };
}

export const ToastContext = createContext<((toast: Toast) => void) | null>(null);

/** Shows a toast. A new one replaces the one showing. */
export function useToast(): (toast: Toast) => void {
  const show = use(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}
