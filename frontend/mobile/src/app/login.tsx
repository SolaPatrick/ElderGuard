import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loginRequestSchema } from '@elderguard/shared';
import { useAuth } from '../auth/authContext';
import { BrandHeader } from '../components/BrandHeader';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { errorMessage } from '../errorMessage';
import { space, useColors } from '../theme';

type Errors = Partial<Record<'username' | 'password', string>>;

/** M-02 Login, with M-34's "session ended" notice and the "server unreachable" state. */
export default function LoginScreen() {
  const { state, login, retry } = useAuth();
  const c = useColors();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (state.status === 'loading') {
    return (
      <Screen centered>
        <BrandHeader />
        <ActivityIndicator accessibilityLabel="Loading" color={c.sys.primary} />
      </Screen>
    );
  }

  if (state.status === 'unreachable') {
    return (
      <Screen centered>
        <BrandHeader />
        <Text style={[styles.title, { color: c.sys.onSurface }]}>Can't reach ElderGuard</Text>
        <Notice tone="error">{state.message}</Notice>
        <Text style={{ color: c.sys.onSurfaceVariant }}>
          You are still signed in. Alerts will show again once the phone is back online.
        </Text>
        <Button label="Try again" onPress={retry} />
      </Screen>
    );
  }

  const reason = state.status === 'anonymous' ? state.reason : undefined;

  const submit = async () => {
    setSubmitError(null);
    const parsed = loginRequestSchema.safeParse({ username, password });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === 'username' || key === 'password') && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data);
    } catch (err) {
      setSubmitError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Screen centered>
      <BrandHeader />
      <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
        Log in
      </Text>
      {reason === 'expired' && !submitError && (
        <Notice tone="info">Your session ended. Log in again to keep receiving alerts.</Notice>
      )}
      {submitError && <Notice tone="error">{submitError}</Notice>}
      <View style={styles.form}>
        <TextField
          label="Username or email"
          value={username}
          onChangeText={setUsername}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          error={errors.username}
        />
        <TextField
          label="Password"
          password
          value={password}
          onChangeText={setPassword}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={errors.password}
        />
        <Button label="Log in" onPress={() => void submit()} loading={submitting} />
      </View>
      <Text style={[styles.hint, { color: c.sys.onSurfaceVariant }]}>
        Forgot your password? Ask your Admin/Head to reset it.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600' },
  form: { gap: space.space16 },
  hint: { fontSize: 14, textAlign: 'center' },
});
