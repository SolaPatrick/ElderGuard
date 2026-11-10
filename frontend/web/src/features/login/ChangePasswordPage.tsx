import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router';
import { changePasswordFormSchema, type ChangePasswordForm } from '@elderguard/shared';
import { api } from '../../api/endpoints';
import { useAuth, useCurrentUser } from '../../auth/authContext';
import { BrandMark } from '../../components/BrandMark';
import { errorMessage } from '../../components/errorMessage';

/** AUTH: change password. Required after logging in with a temporary password. */
export function ChangePasswordPage() {
  const user = useCurrentUser();
  const { replaceSession, logout } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setSubmitError(null);
    try {
      const { token, user: updated } = await api.changePassword({ currentPassword, newPassword });
      replaceSession(token, updated);
      void navigate(from && from !== '/change-password' ? from : '/', { replace: true });
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  });

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
            Change your password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
            {user.mustChangePassword
              ? `Welcome, ${user.fullName}. You logged in with a temporary password. Choose your own to continue.`
              : 'Choose a new password for your account.'}
          </Typography>

          {submitError && (
            <Alert severity="error" sx={{ mb: 4 }} role="alert">
              {submitError}
            </Alert>
          )}

          <Box component="form" onSubmit={onSubmit} noValidate>
            <Stack spacing={4}>
              <TextField
                label="Current password"
                type="password"
                required
                autoComplete="current-password"
                autoFocus
                error={!!errors.currentPassword}
                helperText={errors.currentPassword?.message}
                {...register('currentPassword')}
              />
              <TextField
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                error={!!errors.newPassword}
                helperText={errors.newPassword?.message ?? 'At least 8 characters.'}
                {...register('newPassword')}
              />
              <TextField
                label="Confirm new password"
                type="password"
                required
                autoComplete="new-password"
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
              <Button type="submit" variant="contained" size="large" loading={isSubmitting}>
                Save password
              </Button>
              <Button onClick={() => void logout()} disabled={isSubmitting}>
                Log out
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
