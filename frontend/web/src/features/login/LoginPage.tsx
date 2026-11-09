import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { loginRequestSchema, type LoginRequest } from '@elderguard/shared';
import { useAuth } from '../../auth/authContext';
import { BrandMark } from '../../components/BrandMark';
import { errorMessage } from '../../components/errorMessage';
import { USE_MOCKS } from '../../api/config';

interface LocationState {
  from?: string;
  reason?: 'expired' | 'logged_out';
}

/** AUTH-01 */
export function LoginPage() {
  const { state, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { from, reason } = (location.state ?? {}) as LocationState;
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { username: '', password: '' },
  });

  if (state.status === 'authenticated') return <Navigate to={from ?? '/'} replace />;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values, remember);
      void navigate(from && from !== '/login' ? from : '/', { replace: true });
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
            <Box>
              <Typography variant="h6" component="div">
                ElderGuard
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Demo Home for the Aged
              </Typography>
            </Box>
          </Stack>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 5 }}>
            Log in
          </Typography>

          {reason === 'expired' && !submitError && (
            <Alert severity="info" role="status" sx={{ mb: 4 }}>
              Your session ended. Log in again to keep receiving alerts.
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" sx={{ mb: 4 }} role="alert">
              {submitError}
            </Alert>
          )}

          <Box component="form" onSubmit={onSubmit} noValidate>
            <Stack spacing={4}>
              <TextField
                label="Username or email"
                required
                autoComplete="username"
                autoFocus
                error={!!errors.username}
                helperText={errors.username?.message}
                {...register('username')}
              />
              <TextField
                label="Password"
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                {...register('password')}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showPassword ? 'Hide password' : 'Show password'}>
                          <IconButton
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <FormControlLabel
                  control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                  label="Remember me"
                />
                <Tooltip describeChild title="Password reset is coming soon. Ask your Admin/Head for now.">
                  <Link component="button" type="button" variant="body2" sx={{ fontWeight: 600 }}>
                    Forgot password?
                  </Link>
                </Tooltip>
              </Stack>
              <Button type="submit" variant="contained" size="large" loading={isSubmitting} fullWidth>
                Log in
              </Button>
            </Stack>
          </Box>

          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 5 }}>
            ElderGuard is an assistive monitoring tool. It does not replace caregivers or emergency services.
          </Typography>
          {USE_MOCKS && (
            <Alert severity="info" variant="outlined" role="note" sx={{ mt: 4 }}>
              Demo mode (fake data). Log in as <b>teresa.reyes</b> (Admin/Head) or <b>joel.ramos</b>{' '}
              (Caregiver), password <b>elderguard123</b>.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
