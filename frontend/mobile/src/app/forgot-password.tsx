import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RESET_CODE_PATTERN } from '@elderguard/shared';
import { ApiError, api } from '../api';
import { BrandHeader } from '../components/BrandHeader';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { errorMessage } from '../errorMessage';
import { useNow } from '../hooks/useNow';
import { space, useColors } from '../theme';

type Step =
  | { name: 'request' }
  | { name: 'code'; login: string; sentTo: string | null; resendAt: number }
  | { name: 'password'; resetToken: string }
  | { name: 'done' };

const ASK_ADMIN = 'Ask your Admin/Head to reset your password. You’ll get a temporary one.';

const backToLogin = () => (router.canGoBack() ? router.back() : router.replace('/login'));

function Frame({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const c = useColors();
  return (
    <Screen centered>
      <BrandHeader />
      <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
        {title}
      </Text>
      <Text style={{ color: c.sys.onSurfaceVariant }}>{intro}</Text>
      <View style={styles.form}>{children}</View>
    </Screen>
  );
}

/** M-03 Forgot password, M-04 verify code, M-05 set new password, M-06 success. */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ login?: string }>();
  const [step, setStep] = useState<Step>({ name: 'request' });
  switch (step.name) {
    case 'request':
      return <RequestStep initial={params.login ?? ''} onSent={setStep} />;
    case 'code':
      return <CodeStep step={step} onChange={setStep} />;
    case 'password':
      return <PasswordStep resetToken={step.resetToken} onChange={setStep} />;
    case 'done':
      return (
        <Frame title="Password changed" intro="Your password has been reset. Log in with your new password.">
          <Button label="Back to login" onPress={backToLogin} />
        </Frame>
      );
  }
}

/** M-03: ask for a code by username or email. */
function RequestStep({ initial, onSent }: { initial: string; onSent: (s: Step) => void }) {
  const [login, setLogin] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const value = login.trim();
    if (!value) return setError('Enter your username or email');
    setError(undefined);
    setPending(true);
    try {
      const res = await api.forgotPassword({ login: value });
      onSent({
        name: 'code',
        login: value,
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
        <Notice tone="info">{`Resetting a password by email isn’t available yet. ${ASK_ADMIN}`}</Notice>
      )}
      <TextField
        label="Username or email"
        value={login}
        onChangeText={setLogin}
        autoComplete="username"
        textContentType="username"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
        error={error}
      />
      <Button label="Send code" onPress={() => void submit()} loading={pending} disabled={unavailable} />
      <Button label="Back to login" variant="text" onPress={backToLogin} />
    </Frame>
  );
}

/** M-04: enter the code, or send a new one after the wait. */
function CodeStep({
  step,
  onChange,
}: {
  step: Extract<Step, { name: 'code' }>;
  onChange: (s: Step) => void;
}) {
  const now = useNow();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const wait = Math.max(0, Math.ceil((step.resendAt - now) / 1000));

  const submit = async () => {
    if (!RESET_CODE_PATTERN.test(code)) return setError('Enter the 6-digit code');
    setError(undefined);
    setPending(true);
    try {
      const { resetToken } = await api.verifyResetCode({ login: step.login, code });
      onChange({ name: 'password', resetToken });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) setExpired(true);
      else setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const res = await api.forgotPassword({ login: step.login });
      setCode('');
      setError(undefined);
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
      {expired && <Notice tone="error">This code has expired. Send a new code and try again.</Notice>}
      <TextField
        label="6-digit code"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={error}
      />
      <Button label="Verify code" onPress={() => void submit()} loading={pending} disabled={expired} />
      <Button
        label={wait > 0 ? `Send a new code in ${wait} s` : 'Send a new code'}
        variant="outlined"
        onPress={() => void resend()}
        loading={resending}
        disabled={wait > 0}
      />
      <Button label="Back to login" variant="text" onPress={backToLogin} />
    </Frame>
  );
}

function Rule({ ok, children }: { ok: boolean; children: string }) {
  const c = useColors();
  return (
    <Text
      accessibilityLabel={`${children}: ${ok ? 'done' : 'not yet'}`}
      style={{ color: ok ? c.sys.success : c.sys.onSurfaceVariant }}
    >
      {ok ? '✓' : '○'} <Text style={{ color: c.sys.onSurface }}>{children}</Text>
    </Text>
  );
}

/** M-05: choose the new password, with the rules ticked off as you type. */
function PasswordStep({ resetToken, onChange }: { resetToken: string; onChange: (s: Step) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, setPending] = useState(false);
  const [tried, setTried] = useState(false);
  const longEnough = password.length >= 8;
  const matches = password.length > 0 && password === confirm;

  const submit = async () => {
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
      {error && <Notice tone="error">{error}</Notice>}
      {expired && (
        <Button label="Start again" variant="outlined" onPress={() => onChange({ name: 'request' })} />
      )}
      <TextField
        label="New password"
        password
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        error={tried && !longEnough ? 'Use at least 8 characters' : undefined}
      />
      <TextField
        label="Confirm new password"
        password
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        error={tried && confirm && !matches ? 'The two passwords are different' : undefined}
      />
      <View accessibilityLabel="Password rules" style={styles.rules}>
        <Rule ok={longEnough}>At least 8 characters</Rule>
        <Rule ok={matches}>Both passwords match</Rule>
      </View>
      <Button label="Save password" onPress={() => void submit()} loading={pending} disabled={expired} />
    </Frame>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600' },
  form: { gap: space.space16 },
  rules: { gap: space.space4 },
});
