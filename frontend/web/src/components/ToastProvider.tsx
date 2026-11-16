import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Button, IconButton, Snackbar } from '@mui/material';
import Close from '@mui/icons-material/Close';
import { ToastContext, type Toast } from './toastContext';

const AUTO_HIDE_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  // The key makes a new toast restart its timer even when one is already open.
  const [current, setCurrent] = useState<(Toast & { key: number }) | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((toast: Toast) => {
    setCurrent({ ...toast, key: Date.now() + Math.random() });
    setOpen(true);
  }, []);
  const severity = current?.severity ?? 'success';

  return (
    <ToastContext value={show}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={severity === 'error' ? null : AUTO_HIDE_MS}
        onClose={(_e, reason) => {
          if (reason !== 'clickaway') setOpen(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          variant="filled"
          severity={severity}
          // A custom action replaces MUI's close button, so the close button is added here too.
          action={
            <>
              {current?.action && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setOpen(false);
                    current.action?.onClick();
                  }}
                >
                  {current.action.label}
                </Button>
              )}
              <IconButton color="inherit" size="small" aria-label="Close" onClick={() => setOpen(false)}>
                <Close fontSize="small" />
              </IconButton>
            </>
          }
          sx={{ minWidth: { sm: 360 }, alignItems: 'center' }}
        >
          {current?.message}
        </Alert>
      </Snackbar>
    </ToastContext>
  );
}
