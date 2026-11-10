import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import { Link as RouterLink } from 'react-router';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  FALL_RISK_LABEL,
  basicResidentFormSchema,
  fallRiskSchema,
  residentFormSchema,
  type ResidentForm as ResidentFormValues,
  type ResidentRequest,
  type StaffMember,
} from '@elderguard/shared';
import { useRooms, useStaff } from '../../api/queries';
import { serverFeatures } from '../../api/endpoints';
import { areasLabel } from '../users/staffLabels';
import { roomLabel } from '../rooms/roomStats';
import { ageFrom, SEX_LABEL } from './residentEditing';

export const RESIDENT_FORM_ID = 'resident-form';
const MAX_CONTACTS = 5;

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

/** How many fields have an error message (contacts count one per field). */
function countErrors(errors: FieldErrors): number {
  let n = 0;
  for (const value of Object.values(errors)) {
    if (!value || typeof value !== 'object') continue;
    if ('message' in value && typeof value.message === 'string') n += 1;
    else n += countErrors(value as FieldErrors);
  }
  return n;
}

type Form = UseFormReturn<ResidentFormValues, unknown, ResidentRequest>;

function ContactRows({ form }: { form: Form }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'emergencyContacts' });
  return (
    <Stack spacing={4}>
      {fields.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No emergency contact yet.
        </Typography>
      )}
      {fields.map((f, i) => {
        const e = errors.emergencyContacts?.[i];
        return (
          <Stack
            key={f.id}
            role="group"
            aria-label={`Contact ${i + 1}`}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{ alignItems: { sm: 'flex-start' } }}
          >
            <TextField
              label="Name"
              required
              sx={{ flex: 2 }}
              error={!!e?.fullName}
              helperText={e?.fullName?.message}
              {...register(`emergencyContacts.${i}.fullName`)}
            />
            <TextField
              label="Relationship"
              placeholder="e.g. Son"
              sx={{ flex: 1 }}
              error={!!e?.relationship}
              helperText={e?.relationship?.message}
              {...register(`emergencyContacts.${i}.relationship`)}
            />
            <TextField
              label="Phone"
              required
              type="tel"
              placeholder="0917 555 0134"
              sx={{ flex: 1.5 }}
              error={!!e?.phone}
              helperText={e?.phone?.message}
              {...register(`emergencyContacts.${i}.phone`)}
            />
            <IconButton
              aria-label={`Remove contact ${i + 1}`}
              onClick={() => remove(i)}
              sx={{ mt: { sm: 2 } }}
            >
              <DeleteOutlined />
            </IconButton>
          </Stack>
        );
      })}
      {fields.length < MAX_CONTACTS && (
        <Box>
          <Button
            startIcon={<AddOutlined />}
            onClick={() => append({ fullName: '', relationship: '', phone: '' })}
          >
            {fields.length === 0 ? 'Add contact' : 'Add another contact'}
          </Button>
        </Box>
      )}
    </Stack>
  );
}

/** Active employees, plus anyone already assigned (who may have been deactivated since). */
function CaregiverPicker({ form, staff }: { form: Form; staff: StaffMember[] }) {
  return (
    <Controller
      control={form.control}
      name="caregiverIds"
      render={({ field }) => {
        const byId = new Map(staff.map((s) => [s.id, s]));
        const options = staff.filter(
          (s) => s.role === 'employee' && (s.isActive || field.value.includes(s.id)),
        );
        return (
          <Autocomplete
            multiple
            options={options}
            value={field.value.flatMap((id) => byId.get(id) ?? [])}
            onChange={(_, value) => field.onChange(value.map((s) => s.id))}
            getOptionLabel={(s) => s.fullName}
            getOptionDisabled={(s) => !s.isActive}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderOption={({ key, ...props }, s) => (
              <li key={key} {...props}>
                {s.fullName} · {areasLabel(s)}
                {!s.isActive && ' (deactivated)'}
              </li>
            )}
            renderValue={(value, getItemProps) =>
              value.map((s, index) => {
                const { key, ...props } = getItemProps({ index });
                return (
                  <Chip
                    key={key}
                    {...props}
                    size="small"
                    label={s.isActive ? s.fullName : `${s.fullName} (deactivated)`}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Assigned caregivers"
                inputRef={field.ref}
                onBlur={field.onBlur}
                helperText="Only active employees are listed."
              />
            )}
          />
        );
      }}
    />
  );
}

/**
 * RES-02 Add resident and RES-04 Edit resident. The page puts the submit button in its header.
 * On a server without residentDetails it asks for an age and one free-text contact instead.
 */
export function ResidentForm({
  initial,
  onSubmit,
  submitError,
  onDirtyChange,
}: {
  initial: ResidentFormValues;
  onSubmit: (values: ResidentRequest) => Promise<void>;
  submitError: string | null;
  /** How many top-level fields differ from `initial`, for the unsaved-changes warning. */
  onDirtyChange?: (changed: number) => void;
}) {
  const full = serverFeatures.residentDetails;
  const rooms = useRooms();
  const staff = useStaff();
  const form = useForm<ResidentFormValues, unknown, ResidentRequest>({
    resolver: zodResolver(full ? residentFormSchema : basicResidentFormSchema),
    defaultValues: initial,
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, dirtyFields },
  } = form;
  const [invalidCount, setInvalidCount] = useState(0);
  const birthDate = useWatch({ control, name: 'birthDate' });
  const age = ageFrom(birthDate);

  const changed = Object.keys(dirtyFields).length;
  useEffect(() => onDirtyChange?.(changed), [changed, onDirtyChange]);

  return (
    <Box
      component="form"
      id={RESIDENT_FORM_ID}
      noValidate
      onSubmit={handleSubmit(
        async (values) => {
          setInvalidCount(0);
          await onSubmit(values);
        },
        (errs) => setInvalidCount(countErrors(errs)),
      )}
    >
      <Stack spacing={5} sx={{ maxWidth: 760 }}>
        {submitError && (
          <Alert severity="error" role="alert">
            {submitError}
          </Alert>
        )}
        {invalidCount > 0 && countErrors(errors) > 0 && (
          <Alert severity="error" role="alert">
            Fix {countErrors(errors)} {countErrors(errors) === 1 ? 'field' : 'fields'} before saving.
          </Alert>
        )}

        <Section title="Personal info">
          <Stack spacing={4}>
            <TextField
              label="Full name"
              required
              placeholder="e.g. Benjamin Torres"
              error={!!errors.fullName}
              helperText={errors.fullName?.message}
              {...register('fullName')}
            />
            {full ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Controller
                  control={control}
                  name="sex"
                  render={({ field }) => (
                    <TextField
                      select
                      label="Sex"
                      required
                      sx={{ flex: 1 }}
                      {...field}
                      error={!!errors.sex}
                      helperText={errors.sex?.message}
                    >
                      {(['female', 'male'] as const).map((s) => (
                        <MenuItem key={s} value={s}>
                          {SEX_LABEL[s]}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <TextField
                  label="Birth date"
                  required
                  type="date"
                  sx={{ flex: 1 }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!errors.birthDate}
                  helperText={errors.birthDate?.message ?? (age !== null ? `Age ${age}` : ' ')}
                  {...register('birthDate')}
                />
              </Stack>
            ) : (
              <TextField
                label="Age"
                inputMode="numeric"
                sx={{ maxWidth: 200 }}
                error={!!errors.age}
                helperText={errors.age?.message ?? 'Optional.'}
                {...register('age')}
              />
            )}
          </Stack>
        </Section>

        <Section title="Room or monitoring area">
          <Controller
            control={control}
            name="roomId"
            render={({ field }) => (
              <TextField
                select
                label="Room"
                required
                fullWidth
                {...field}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                error={!!errors.roomId}
                helperText={
                  errors.roomId?.message ??
                  (rooms.isError ? (
                    'Could not load the rooms. Reload the page to try again.'
                  ) : (
                    <>
                      Rooms must exist first.{' '}
                      <Link component={RouterLink} to="/rooms">
                        Rooms &amp; Areas
                      </Link>
                    </>
                  ))
                }
              >
                <MenuItem value="" disabled>
                  Choose a room
                </MenuItem>
                {(rooms.data ?? []).map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {roomLabel(r)}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
        </Section>

        <Section title={full ? 'Emergency contacts' : 'Emergency contact'}>
          {full ? (
            <ContactRows form={form} />
          ) : (
            <TextField
              label="Emergency contact"
              fullWidth
              placeholder="e.g. Carlo Torres (son) 0917 555 0134"
              error={!!errors.emergencyContact}
              helperText={errors.emergencyContact?.message ?? 'Name, relationship and phone number.'}
              {...register('emergencyContact')}
            />
          )}
        </Section>

        <Section title="Care notes">
          <Stack spacing={4}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              {full && (
                <TextField
                  label="Mobility aid"
                  placeholder="e.g. Cane, Walker"
                  sx={{ flex: 1 }}
                  error={!!errors.mobilityAid}
                  helperText={errors.mobilityAid?.message ?? 'Leave empty if none.'}
                  {...register('mobilityAid')}
                />
              )}
              <Controller
                control={control}
                name="fallRisk"
                render={({ field }) => (
                  <TextField select label="Fall-risk level" required sx={{ flex: 1 }} {...field}>
                    {fallRiskSchema.options.map((r) => (
                      <MenuItem key={r} value={r}>
                        {FALL_RISK_LABEL[r]}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Stack>
            <TextField
              label="Notes"
              multiline
              minRows={3}
              error={!!errors.careNotes}
              helperText={
                errors.careNotes?.message ?? 'What caregivers should know, e.g. needs help at night.'
              }
              {...register('careNotes')}
            />
          </Stack>
        </Section>

        {full && (
          <Section title="Assigned caregivers">
            {staff.isError ? (
              <Typography variant="body2" color="error">
                Could not load the staff list. Reload the page to try again.
              </Typography>
            ) : (
              <CaregiverPicker form={form} staff={staff.data ?? []} />
            )}
          </Section>
        )}
      </Stack>
    </Box>
  );
}
