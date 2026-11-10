import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  createStaffFormSchema,
  roleSchema,
  type CreateStaffForm,
  type CreateStaffRequest,
} from '@elderguard/shared';
import { serverFeatures } from '../../api/endpoints';
import { useRooms } from '../../api/queries';
import { SkeletonRows } from '../../components/QueryStates';
import { ROLE_LABEL } from './staffLabels';

/** Editing keeps the username as it is (it can't be changed), so it isn't re-checked. */
const editSchema = createStaffFormSchema.extend({ username: z.string() });

export const STAFF_FORM_ID = 'staff-form';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 5 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 4 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

const roomLabel = (r: { name: string; wing: string | null }) => (r.wing ? `${r.name} · ${r.wing}` : r.name);

/**
 * USR-02 Create user and USR-05 Edit user. The page puts the submit button in its header
 * (form={STAFF_FORM_ID}); this component reports the cleaned values through onSubmit.
 */
export function StaffForm({
  mode,
  initial,
  onSubmit,
  submitError,
  lockRole = false,
  footer,
}: {
  mode: 'create' | 'edit';
  initial: CreateStaffForm;
  onSubmit: (values: CreateStaffRequest) => Promise<void>;
  submitError: string | null;
  /** The signed-in Admin/Head can't change their own role. */
  lockRole?: boolean;
  footer?: ReactNode;
}) {
  const rooms = useRooms();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateStaffForm, unknown, CreateStaffRequest>({
    resolver: zodResolver(mode === 'create' ? createStaffFormSchema : editSchema),
    defaultValues: initial,
  });
  const role = useWatch({ control, name: 'role' });

  return (
    <Box
      component="form"
      id={STAFF_FORM_ID}
      noValidate
      onSubmit={handleSubmit(async (values) => {
        // Area assignment only applies to employees; the Admin/Head sees everything.
        await onSubmit({ ...values, areaIds: values.role === 'admin' ? [] : values.areaIds });
      })}
    >
      <Stack spacing={5} sx={{ maxWidth: 760 }}>
        {submitError && (
          <Alert severity="error" role="alert">
            {submitError}
          </Alert>
        )}

        <Section title="Profile">
          <Stack spacing={4}>
            <TextField
              label="Full name"
              required
              autoFocus={mode === 'create'}
              error={!!errors.fullName}
              helperText={errors.fullName?.message}
              {...register('fullName')}
            />
            <TextField
              label="Username"
              required={mode === 'create'}
              disabled={mode === 'edit'}
              autoComplete="off"
              error={!!errors.username}
              helperText={
                errors.username?.message ??
                (mode === 'create'
                  ? 'Used to log in. Lowercase letters, numbers, dots, dashes and underscores.'
                  : "Usernames can't be changed.")
              }
              {...register('username')}
            />
            <TextField
              label="Email"
              type="email"
              autoComplete="off"
              error={!!errors.email}
              helperText={errors.email?.message ?? 'Optional. Can also be used to log in.'}
              {...register('email')}
            />
          </Stack>
        </Section>

        <Section title="Role">
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <FormControl disabled={lockRole}>
                <RadioGroup row aria-label="Role" {...field}>
                  {roleSchema.options.map((r) => (
                    <FormControlLabel key={r} value={r} control={<Radio />} label={ROLE_LABEL[r]} />
                  ))}
                </RadioGroup>
                <FormHelperText sx={{ mx: 0 }}>
                  {lockRole
                    ? "You can't change your own role."
                    : 'The Admin/Head manages the whole facility. Employees handle alerts in their areas.'}
                </FormHelperText>
              </FormControl>
            )}
          />
        </Section>

        <Section title="Assigned rooms and areas">
          {role === 'admin' ? (
            <Typography variant="body2" color="text.secondary">
              The Admin/Head sees every room and area.
            </Typography>
          ) : !serverFeatures.areaAssignment ? (
            <Typography variant="body2" color="text.secondary">
              Assigning rooms is not available on the server yet, so employees see every room for now.
            </Typography>
          ) : rooms.isPending ? (
            <SkeletonRows rows={2} />
          ) : rooms.isError ? (
            <Alert severity="error" variant="outlined">
              Could not load the rooms. Reload the page to try again.
            </Alert>
          ) : (
            <Controller
              control={control}
              name="areaIds"
              render={({ field }) => (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    The employee gets alerts and sees residents and cameras only in these rooms.
                  </Typography>
                  <FormGroup
                    aria-label="Assigned rooms and areas"
                    sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}
                  >
                    {rooms.data.map((r) => (
                      <FormControlLabel
                        key={r.id}
                        label={roomLabel(r)}
                        control={
                          <Checkbox
                            checked={field.value.includes(r.id)}
                            onChange={(e) =>
                              field.onChange(
                                e.target.checked
                                  ? [...field.value, r.id]
                                  : field.value.filter((id) => id !== r.id),
                              )
                            }
                          />
                        }
                      />
                    ))}
                  </FormGroup>
                </>
              )}
            />
          )}
        </Section>

        {footer}
      </Stack>
    </Box>
  );
}
