import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { api } from '../api/endpoints';
import { useAuth, useCurrentUser } from '../auth/authContext';
import { errorMessage } from '../components/errorMessage';
import { useNow } from '../hooks/useNow';

/** The warning opens this long before the login ends. */
const WARN_BEFORE_MS = 5 * 60_000;

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * AUTH-10: a login lasts a fixed time (one shift on Den's backend). Before it ends, warn the user
 * and let them enter their password to get a new login, so the monitoring screen keeps
 * receiving alerts. The server has no way to extend a login, so the password is needed.
 */
export function SessionTimeoutDialog() {
  const { expiresAt, replaceSession, logout } = useAuth();
  const user = useCurrentUser();
  const now = useNow();
  const [closedFor, setClosedFor] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (expiresAt === null) return null;
  const left = expiresAt - now;
  const open = left > 0 && left <= WARN_BEFORE_MS && closedFor !== expiresAt;
  if (!open) return null;

  const stay = async () => {
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { token, user: fresh } = await api.login({ username: user.username, password });
      setPassword('');
      replaceSession(token, fresh);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open maxWidth="xs" fullWidth aria-labelledby="session-timeout-title">
      <DialogTitle id="session-timeout-title" sx={{ pr: 12 }}>
        Your session is about to expire
      </DialogTitle>
      <IconButton
        aria-label="Close"
        onClick={() => setClosedFor(expiresAt)}
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <Close />
      </IconButton>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          You will be logged out in
        </Typography>
        <Typography
          variant="h3"
          component="p"
          sx={{ fontWeight: 600, my: 2, fontVariantNumeric: 'tabular-nums' }}
          aria-live="off"
        >
          {countdown(left)}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Enter your password to stay signed in, so this screen keeps receiving alerts.
        </Typography>
        {error && (
          <Alert severity="error" role="alert" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        <form
          id="session-timeout-form"
          onSubmit={(e) => {
            e.preventDefault();
            void stay();
          }}
        >
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            autoFocus
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={() => void logout()} disabled={busy}>
          Log out
        </Button>
        <Button type="submit" form="session-timeout-form" variant="contained" loading={busy}>
          Stay signed in
        </Button>
      </DialogActions>
    </Dialog>
  );
}
