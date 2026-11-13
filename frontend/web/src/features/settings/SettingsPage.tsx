import { useEffect, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  InputAdornment,
  MenuItem,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Controller, useForm, type DefaultValues, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link as RouterLink, Navigate, useParams } from 'react-router';
import {
  detectionSettingsSchema,
  generalSettingsSchema,
  notificationSettingsSchema,
  securitySettingsSchema,
  type DetectionSettings,
  type FacilitySettings,
  type GeneralSettings,
  type NotificationSettings,
  type SecuritySettings,
  type SettingsSection,
} from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { useSaveSettings, useSettings } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { errorMessage } from '../../components/errorMessage';
import { useToast } from '../../components/toastContext';

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'detection', label: 'Detection & monitoring' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'security', label: 'Security' },
];

const TIME_ZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['Asia/Manila', 'UTC'];
  }
})();

/** One section's form: loads the saved values, validates, saves, and says so. */
function useSectionForm<S extends SettingsSection>(
  section: S,
  saved: FacilitySettings[S],
  resolver: Resolver<FacilitySettings[S] & FieldValues>,
) {
  const save = useSaveSettings(section);
  const toast = useToast();
  const form = useForm<FacilitySettings[S] & FieldValues>({
    resolver,
    defaultValues: saved as DefaultValues<FacilitySettings[S] & FieldValues>,
  });
  const { reset } = form;
  useEffect(() => reset(saved as FacilitySettings[S] & FieldValues), [saved, reset]);
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(values, { onSuccess: () => toast({ message: 'Settings saved' }) }),
  );
  return { form, save, onSubmit };
}

function SectionCard({
  title,
  description,
  onSubmit,
  saving,
  dirty,
  error,
  onCancel,
  children,
}: {
  title: string;
  description: string;
  onSubmit: () => void;
  saving: boolean;
  dirty: boolean;
  error: unknown;
  onCancel: () => void;
  children: ReactNode;
}) {
  return (
    <Card sx={{ maxWidth: 760 }}>
      <CardContent sx={{ p: 6 }}>
        <Box
          component="form"
          noValidate
          onSubmit={(e) => (e.preventDefault(), onSubmit())}
          aria-label={title}
        >
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
            {description}
          </Typography>
          <Stack spacing={5}>{children}</Stack>
          {error != null && (
            <Alert severity="error" sx={{ mt: 5 }}>
              {errorMessage(error)}
            </Alert>
          )}
          <Stack direction="row" spacing={3} sx={{ mt: 6 }}>
            <Button type="submit" variant="contained" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
            <Button variant="outlined" onClick={onCancel} disabled={!dirty || saving}>
              Discard changes
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

/** SET-01 */
function GeneralForm({ saved }: { saved: GeneralSettings }) {
  const { form, save, onSubmit } = useSectionForm('general', saved, zodResolver(generalSettingsSchema));
  const { register, control, formState, reset } = form;
  const e = formState.errors;
  return (
    <SectionCard
      title="General"
      description="How the facility is named and how dates and times are shown."
      onSubmit={onSubmit}
      saving={save.isPending}
      dirty={formState.isDirty}
      error={save.error}
      onCancel={() => reset(saved)}
    >
      <TextField
        label="Facility name"
        required
        error={!!e.facilityName}
        helperText={e.facilityName?.message}
        {...register('facilityName')}
      />
      <TextField
        label="Address"
        multiline
        minRows={2}
        error={!!e.address}
        helperText={e.address?.message}
        {...register('address')}
      />
      <TextField
        label="Contact number"
        error={!!e.contactNumber}
        helperText={e.contactNumber?.message}
        {...register('contactNumber')}
      />
      <Controller
        control={control}
        name="timeZone"
        render={({ field }) => (
          <TextField select label="Time zone" {...field}>
            {TIME_ZONES.map((z) => (
              <MenuItem key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
        <Controller
          control={control}
          name="dateFormat"
          render={({ field }) => (
            <TextField select label="Date format" {...field}>
              <MenuItem value="d MMM yyyy">13 Nov 2026</MenuItem>
              <MenuItem value="MM/dd/yyyy">11/13/2026</MenuItem>
              <MenuItem value="yyyy-MM-dd">2026-11-13</MenuItem>
            </TextField>
          )}
        />
        <Controller
          control={control}
          name="timeFormat"
          render={({ field }) => (
            <TextField select label="Time format" {...field}>
              <MenuItem value="12h">2:41 PM</MenuItem>
              <MenuItem value="24h">14:41</MenuItem>
            </TextField>
          )}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        A facility logo can be added once the server can store pictures.
      </Typography>
    </SectionCard>
  );
}

/** SET-02 */
function DetectionForm({ saved }: { saved: DetectionSettings }) {
  const { form, save, onSubmit } = useSectionForm('detection', saved, zodResolver(detectionSettingsSchema));
  const { register, control, formState, reset } = form;
  const e = formState.errors;
  return (
    <SectionCard
      title="Detection & monitoring"
      description="How sure the camera must be before it raises a fall alert, and how long pictures are kept."
      onSubmit={onSubmit}
      saving={save.isPending}
      dirty={formState.isDirty}
      error={save.error}
      onCancel={() => reset(saved)}
    >
      <Controller
        control={control}
        name="confidenceThreshold"
        render={({ field }) => (
          <Box>
            <FormLabel id="confidence-label">
              Detection confidence: {Math.round(field.value * 100)}%
            </FormLabel>
            <Slider
              aria-labelledby="confidence-label"
              min={0.2}
              max={0.95}
              step={0.05}
              value={field.value}
              onChange={(_, v) => field.onChange(v)}
              getAriaValueText={(v) => `${Math.round(v * 100)}%`}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
              sx={{ maxWidth: 480, display: 'block' }}
            />
            <FormHelperText>Lower catches more falls but raises more false alarms.</FormHelperText>
          </Box>
        )}
      />
      <TextField
        label="Confirmation window"
        type="number"
        slotProps={{
          input: { endAdornment: <InputAdornment position="end">seconds</InputAdornment> },
          htmlInput: { step: 0.5 },
        }}
        error={!!e.confirmationSeconds}
        helperText={
          e.confirmationSeconds?.message ?? 'How long a person must stay down before the alert goes off.'
        }
        sx={{ maxWidth: 320 }}
        {...register('confirmationSeconds')}
      />
      <TextField
        label="Duplicate alert cooldown"
        type="number"
        slotProps={{ input: { endAdornment: <InputAdornment position="end">seconds</InputAdornment> } }}
        error={!!e.duplicateCooldownSeconds}
        helperText={
          e.duplicateCooldownSeconds?.message ??
          'A person found down at the same spot within this time is not a new fall.'
        }
        sx={{ maxWidth: 320 }}
        {...register('duplicateCooldownSeconds')}
      />
      <Controller
        control={control}
        name="retentionDays"
        render={({ field, fieldState }) => (
          <Stack spacing={2}>
            <FormControlLabel
              control={
                <Switch checked={field.value !== null} onChange={(_, on) => field.onChange(on ? 90 : null)} />
              }
              label="Delete alert pictures after a while"
            />
            {field.value !== null && (
              <TextField
                label="Keep pictures for"
                type="number"
                value={field.value}
                onChange={(ev) => field.onChange(ev.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">days</InputAdornment> } }}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                sx={{ maxWidth: 320 }}
              />
            )}
            {field.value === null && (
              <FormHelperText>Pictures are kept until someone deletes them.</FormHelperText>
            )}
          </Stack>
        )}
      />
    </SectionCard>
  );
}

/** SET-03 */
function NotificationsForm({ saved }: { saved: NotificationSettings }) {
  const { form, save, onSubmit } = useSectionForm(
    'notifications',
    saved,
    zodResolver(notificationSettingsSchema),
  );
  const { register, control, formState, reset, watch } = form;
  const e = formState.errors;
  const toggle = (name: 'push' | 'sms' | 'email' | 'repeatUntilAcknowledged' | 'escalate', label: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormControlLabel
          control={<Switch checked={field.value} onChange={(_, v) => field.onChange(v)} />}
          label={label}
        />
      )}
    />
  );
  return (
    <SectionCard
      title="Notifications"
      description="How staff are told about falls and SOS."
      onSubmit={onSubmit}
      saving={save.isPending}
      dirty={formState.isDirty}
      error={save.error}
      onCancel={() => reset(saved)}
    >
      <Stack>
        <FormLabel>Channels</FormLabel>
        <FormControlLabel control={<Switch checked disabled />} label="In the app (always on)" />
        {toggle('push', 'Push notifications on phones')}
        {toggle('sms', 'Text message (SMS)')}
        {toggle('email', 'Email')}
        <FormHelperText>
          Caregivers get alerts for their assigned areas, and the Admin/Head for every area.
        </FormHelperText>
      </Stack>
      {toggle('repeatUntilAcknowledged', 'Repeat the alarm sound until someone acknowledges')}
      <Stack spacing={2}>
        {toggle('escalate', 'Tell the Admin/Head when nobody acknowledges')}
        {watch('escalate') && (
          <TextField
            label="After"
            type="number"
            slotProps={{ input: { endAdornment: <InputAdornment position="end">minutes</InputAdornment> } }}
            error={!!e.escalateAfterMinutes}
            helperText={e.escalateAfterMinutes?.message}
            sx={{ maxWidth: 320 }}
            {...register('escalateAfterMinutes')}
          />
        )}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Alarm sound and volume are set on each computer in{' '}
        <RouterLink to="/profile/alerts" style={{ color: 'inherit' }}>
          Alert preferences
        </RouterLink>
        .
      </Typography>
    </SectionCard>
  );
}

/** SET-04 */
function SecurityForm({ saved }: { saved: SecuritySettings }) {
  const { form, save, onSubmit } = useSectionForm('security', saved, zodResolver(securitySettingsSchema));
  const { register, formState, reset } = form;
  const e = formState.errors;
  const number = (name: keyof SecuritySettings, label: string, unit: string, help: string) => (
    <TextField
      label={label}
      type="number"
      slotProps={{ input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } }}
      error={!!e[name]}
      helperText={e[name]?.message ?? help}
      sx={{ maxWidth: 360 }}
      {...register(name)}
    />
  );
  return (
    <SectionCard
      title="Security"
      description="Passwords, how long a login lasts, and what happens after wrong passwords."
      onSubmit={onSubmit}
      saving={save.isPending}
      dirty={formState.isDirty}
      error={save.error}
      onCancel={() => reset(saved)}
    >
      {number(
        'minPasswordLength',
        'Shortest password allowed',
        'characters',
        'Applies the next time someone sets a password.',
      )}
      {number(
        'sessionHours',
        'Login lasts',
        'hours',
        'Staff are asked for their password again after this. One shift is usually 8 hours.',
      )}
      {number('maxFailedLogins', 'Lock an account after', 'wrong passwords', 'Wrong passwords in a row.')}
      {number(
        'lockMinutes',
        'Keep it locked for',
        'minutes',
        'The Admin/Head can also reset the password to unlock it sooner.',
      )}
    </SectionCard>
  );
}

/** SET-01 to SET-04: facility settings for the Admin/Head, one tab per section. */
export function SettingsPage() {
  const { section } = useParams();
  const settings = useSettings();
  const current = SECTIONS.find((s) => s.id === section);
  if (!current) return <Navigate to="/settings/general" replace />;

  const notOnServer = settings.error instanceof ApiError && settings.error.status === 501;

  return (
    <>
      <PageHeader title="Settings" subtitle="Facility-wide settings. Changes apply to everyone." />
      <Tabs value={current.id} aria-label="Settings sections" variant="scrollable" sx={{ mb: 6 }}>
        {SECTIONS.map((s) => (
          <Tab key={s.id} value={s.id} label={s.label} component={RouterLink} to={`/settings/${s.id}`} />
        ))}
      </Tabs>
      {settings.isPending ? (
        <SkeletonRows rows={5} />
      ) : notOnServer ? (
        <Alert severity="info" sx={{ maxWidth: 760 }}>
          Settings can't be changed from the app yet. The server keeps them in its configuration file, so ask
          whoever runs the server to change them there.
        </Alert>
      ) : settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
      ) : current.id === 'general' ? (
        <GeneralForm saved={settings.data.general} />
      ) : current.id === 'detection' ? (
        <DetectionForm saved={settings.data.detection} />
      ) : current.id === 'notifications' ? (
        <NotificationsForm saved={settings.data.notifications} />
      ) : (
        <SecurityForm saved={settings.data.security} />
      )}
    </>
  );
}
