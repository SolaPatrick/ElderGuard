import { useState, type FormEvent, type ReactNode } from 'react';
import { Alert, Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import RadioButtonUncheckedOutlined from '@mui/icons-material/RadioButtonUncheckedOutlined';
import { Link as RouterLink, useLocation } from 'react-router';
import { RESET_CODE_PATTERN } from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { api } from '../../api/endpoints';
import { BrandMark } from '../../components/BrandMark';
import { errorMessage } from '../../components/errorMessage';
import { useNow } from '../../hooks/useNow';

type Step =
  | { name: 'request' }
  | { name: 'code'; login: string; sentTo: string | null; resendAt: number }
  | { name: 'password'; resetToken: string }
  | { name: 'done' };

const ASK_ADMIN =
  'Ask your Admin/Head to reset your password from Users & Access. You’ll get a temporary one.';

function Frame({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <Box
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 4, bgcolor: 'background.default' }}
    >
      <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 4 }}>
        <CardContent sx={{ p: 6 }}>
          <Stack direction="row" spacing={3} sx={{ alignItems: 'center', mb: 6 }}>
            <BrandMark tonal />
            <Typography variant="h6" component="div">
              ElderGuard
            </Typography>
          </Stack>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 2 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
            {intro}
          </Typography>
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}

const BackToLogin = () => (
  <Link component={RouterLink} to="/login" variant="body2" sx={{ fontWeight: 600, textAlign: 'center' }}>
    Back to login
  </Link>
);

/** AUTH-02: ask for a code by username or email. */
function RequestStep({ initial, onSent }: { initial: string; onSent: (step: Step) => void }) {
  const [login, setLogin] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!login.trim()) return setError('Enter your username or email');
    setError(null);
    setPending(true);
    try {
      const res = await api.forgotPassword({ login: login.trim() });
      onSent({
        name: 'code',
        login: login.trim(),
        sentTo: res.sentTo,
        resendAt: Date.now() + res.resendAfterSeconds * 1000,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) setUnavailable(true);
      else setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Frame title="Forgot password" intro="Enter your username or email. We’ll email you a 6-digit code.">
      {unavailable && (
        <Alert severity="info" sx={{ mb: 4 }}>
          Resetting a password by email isn’t available yet. {ASK_ADMIN}
        </Alert>
      )}
      <Box component="form" onSubmit={(e) => void submit(e)} noValidate>
        <Stack spacing={4}>
          <TextField
            label="Username or email"
            required
            autoComplete="username"
            autoFocus
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            error={!!error}
            helperText={error ?? ' '}
          />
          <Button type="submit" variant="contained" size="large" loading={pending} disabled={unavailable}>
            Send code
          </Button>
          <BackToLogin />
        </Stack>
      </Box>
    </Frame>
  );
}

/** AUTH-03: enter the code, or send a new one after the wait. */
function CodeStep({
  step,
  onChange,
}: {
  step: Extract<Step, { name: 'code' }>;
  onChange: (step: Step) => void;
}) {
  const now = useNow();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const wait = Math.max(0, Math.ceil((step.resendAt - now) / 1000));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!RESET_CODE_PATTERN.test(code)) return setError('Enter the 6-digit code');
    setError(null);
    setPending(true);
    try {
      const { resetToken } = await api.verifyResetCode({ login: step.login, code });
      onChange({ name: 'password', resetToken });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setExpired(true);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const res = await api.forgotPassword({ login: step.login });
      setCode('');
      setError(null);
      setExpired(false);
      onChange({ ...step, sentTo: res.sentTo, resendAt: Date.now() + res.resendAfterSeconds * 1000 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <Frame
      title="Enter the code"
      intro={
        step.sentTo
          ? `We sent a 6-digit code to ${step.sentTo}. It works for 10 minutes.`
          : `If “${step.login}” has an email address, we sent a 6-digit code to it. No email on your account? ${ASK_ADMIN}`
      }
    >
      {expired && (
        <Alert severity="warning" sx={{ mb: 4 }} role="alert">
          This code has expired. Send a new code and try again.
        </Alert>
      )}
      <Box component="form" onSubmit={(e) => void submit(e)} noValidate>
        <Stack spacing={4}>
          <TextField
            label="6-digit code"
            required
            autoFocus
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={!!error && !expired}
            helperText={(!expired && error) || ' '}
            slotProps={{
              htmlInput: { inputMode: 'numeric', maxLength: 6, style: { letterSpacing: '0.4em' } },
            }}
          />
          <Button type="submit" variant="contained" size="large" loading={pending} disabled={expired}>
            Verify code
          </Button>
          <Button onClick={() => void resend()} disabled={wait > 0} loading={resending}>
            {wait > 0 ? `Send a new code in ${wait} s` : 'Send a new code'}
          </Button>
          <BackToLogin />
        </Stack>
      </Box>
    </Frame>
  );
}

function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <Stack
      component="li"
      direction="row"
      spacing={2}
      sx={{ alignItems: 'center', color: ok ? 'success.main' : 'text.secondary' }}
    >
      {ok ? <CheckCircleOutlined fontSize="small" /> : <RadioButtonUncheckedOutlined fontSize="small" />}
      <Typography variant="body2" sx={{ color: 'text.primary' }}>
        {children}
        <Box
          component="span"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {ok ? ' (done)' : ' (not yet)'}
        </Box>
      </Typography>
    </Stack>
  );
}

/** AUTH-04: choose the new password, with the rules ticked off as you type. */
function PasswordStep({ resetToken, onChange }: { resetToken: string; onChange: (step: Step) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [tried, setTried] = useState(false);
  const longEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!longEnough || !matches) return;
    setError(null);
    setPending(true);
    try {
      await api.resetPassword({ resetToken, newPassword: password });
      onChange({ name: 'done' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setExpired(true);
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <Frame title="Set a new password" intro="Choose a password you don’t use anywhere else.">
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 4 }}
          role="alert"
          action={
            expired ? (
              <Button color="inherit" size="small" onClick={() => onChange({ name: 'request' })}>
                Start again
              </Button>
            ) : undefined
          }
        >
          {error}
        </Alert>
      )}
      <Box component="form" onSubmit={(e) => void submit(e)} noValidate>
        <Stack spacing={4}>
          <TextField
            label="New password"
            type="password"
            required
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={tried && !longEnough}
          />
          <TextField
            label="Confirm new password"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={tried && !matches}
            helperText={tried && confirm && !matches ? 'The two passwords are different' : ' '}
          />
          <Stack
            component="ul"
            spacing={1}
            aria-label="Password rules"
            sx={{ m: 0, p: 0, listStyle: 'none' }}
          >
            <Rule ok={longEnough}>At least 8 characters</Rule>
            <Rule ok={matches}>Both passwords match</Rule>
          </Stack>
          <Button type="submit" variant="contained" size="large" loading={pending} disabled={expired}>
            Save password
          </Button>
        </Stack>
      </Box>
    </Frame>
  );
}

/** AUTH-02 to AUTH-05: reset a forgotten password with a code sent by email. */
export function ForgotPasswordPage() {
  const initial = (useLocation().state as { login?: string } | null)?.login ?? '';
  const [step, setStep] = useState<Step>({ name: 'request' });

  switch (step.name) {
    case 'request':
      return <RequestStep initial={initial} onSent={setStep} />;
    case 'code':
      return <CodeStep step={step} onChange={setStep} />;
    case 'password':
      return <PasswordStep resetToken={step.resetToken} onChange={setStep} />;
    case 'done':
      return (
        <Frame title="Password changed" intro="Your password has been reset. Log in with your new password.">
          <Button variant="contained" size="large" fullWidth component={RouterLink} to="/login">
            Back to login
          </Button>
        </Frame>
      );
  }
}
