import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { changePasswordFormSchema, type ChangePasswordForm } from '@elderguard/shared';
import { api } from '../api';
import { useAuth, useCurrentUser } from '../auth/authContext';
import { BrandHeader } from '../components/BrandHeader';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { errorMessage } from '../errorMessage';
import { space, useColors } from '../theme';

type Field = keyof ChangePasswordForm;

/** M-07 Change temporary password (forced after the first login) and M-30 Change password. */
export default function ChangePasswordScreen() {
  const { replaceSession, logout } = useAuth();
  const user = useCurrentUser();
  const c = useColors();
  const [form, setForm] = useState<ChangePasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Remember why the screen opened: once the forced change is saved, mustChangePassword turns false.
  const [forced] = useState(user.mustChangePassword);

  const set = (field: Field) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  const submit = async () => {
    setSubmitError(null);
    const parsed = changePasswordFormSchema.safeParse(form);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { currentPassword, newPassword } = parsed.data;
      const { token, user: updated } = await api.changePassword({ currentPassword, newPassword });
      await replaceSession(token, updated);
      // A forced change continues to Home through the Redirect below, once the guards allow it.
      if (!forced) {
        if (router.canGoBack()) router.back();
        else router.replace('/');
      }
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // This screen stays allowed for signed-in users (M-30), so leaving it is up to the screen.
  if (forced && !user.mustChangePassword) return <Redirect href="/" />;

  return (
    <Screen centered={forced}>
      <BrandHeader />
      <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
        Change your password
      </Text>
      <Text style={{ color: c.sys.onSurfaceVariant }}>
        {forced
          ? `Welcome, ${user.fullName}. You logged in with a temporary password. Choose your own to continue.`
          : 'Choose a new password for your account.'}
      </Text>
      {submitError && <Notice tone="error">{submitError}</Notice>}
      <View style={styles.form}>
        <TextField
          label="Current password"
          password
          value={form.currentPassword}
          onChangeText={set('currentPassword')}
          autoComplete="current-password"
          textContentType="password"
          error={errors.currentPassword}
        />
        <TextField
          label="New password"
          password
          value={form.newPassword}
          onChangeText={set('newPassword')}
          autoComplete="new-password"
          textContentType="newPassword"
          error={errors.newPassword}
          helper="At least 8 characters."
        />
        <TextField
          label="Confirm new password"
          password
          value={form.confirmPassword}
          onChangeText={set('confirmPassword')}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={errors.confirmPassword}
        />
        <Button label="Save password" onPress={() => void submit()} loading={submitting} />
        {forced ? (
          <Button label="Log out" variant="text" onPress={() => void logout()} disabled={submitting} />
        ) : (
          <Button
            label="Cancel"
            variant="text"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            disabled={submitting}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600' },
  form: { gap: space.space16 },
});
