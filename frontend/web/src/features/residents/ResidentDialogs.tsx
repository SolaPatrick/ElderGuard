import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ARCHIVE_REASON_LABEL,
  archiveReasonSchema,
  archiveRequestSchema,
  type ArchiveForm,
  type ArchiveRequest,
  type ResidentDetail,
} from '@elderguard/shared';
import { serverFeatures } from '../../api/endpoints';
import {
  useArchiveResident,
  useResidents,
  useRestoreResident,
  useRooms,
  useSaveResident,
  useStaff,
} from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { areasLabel } from '../users/staffLabels';
import { roomLabel } from '../rooms/roomStats';
import { currentRequest } from './residentEditing';

const ErrorAlert = ({ error }: { error: string | null }) =>
  error ? (
    <Alert severity="error" role="alert" sx={{ mb: 4 }}>
      {error}
    </Alert>
  ) : null;

/** Runs a save and keeps the dialog open with the server's message when it fails. */
function useAction(onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return { error, run };
}

const residentCount = (n: number) => (n === 1 ? '1 resident' : `${n} residents`);

/** RES-05 Assign / transfer room. */
export function TransferRoomDialog({ resident, onClose }: { resident: ResidentDetail; onClose: () => void }) {
  const rooms = useRooms();
  const residents = useResidents();
  const save = useSaveResident(resident.id);
  const [roomId, setRoomId] = useState('');
  const [touched, setTouched] = useState(false);
  const { error, run } = useAction(onClose);
  const living = (id: string) => (residents.data ?? []).filter((r) => r.room?.id === id).length;
  const others = (rooms.data ?? []).filter((r) => r.id !== resident.room?.id);

  const submit = () => {
    setTouched(true);
    if (roomId === '') return;
    void run(() => save.mutateAsync({ ...currentRequest(resident), roomId }));
  };

  return (
    <Dialog open onClose={() => !save.isPending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{resident.room ? 'Transfer room' : 'Assign room'}</DialogTitle>
      <DialogContent>
        <ErrorAlert error={error} />
        <Typography variant="caption" color="text.secondary" component="div">
          Current room
        </Typography>
        <Typography variant="body2" sx={{ mb: 4 }}>
          {resident.room
            ? `${roomLabel(resident.room)} · ${residentCount(living(resident.room.id))}`
            : 'No room assigned'}
        </Typography>
        <FormControl error={touched && roomId === ''} fullWidth>
          <FormLabel id="new-room-label" required>
            New room or area
          </FormLabel>
          {rooms.isPending ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Loading rooms…
            </Typography>
          ) : rooms.isError ? (
            <FormHelperText>Could not load the rooms. Close this and try again.</FormHelperText>
          ) : others.length === 0 ? (
            <FormHelperText>There is no other room yet. Add one in Rooms &amp; Areas.</FormHelperText>
          ) : (
            <RadioGroup
              aria-labelledby="new-room-label"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              sx={{ maxHeight: 280, overflowY: 'auto', flexWrap: 'nowrap' }}
            >
              {others.map((r) => (
                <FormControlLabel
                  key={r.id}
                  value={r.id}
                  control={<Radio />}
                  label={
                    <>
                      {roomLabel(r)}{' '}
                      <Typography component="span" variant="body2" color="text.secondary">
                        · {residentCount(living(r.id))}
                      </Typography>
                    </>
                  }
                />
              ))}
            </RadioGroup>
          )}
          {touched && roomId === '' && <FormHelperText>Choose the new room</FormHelperText>}
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button variant="contained" loading={save.isPending} onClick={submit}>
          {resident.room ? 'Transfer' : 'Assign room'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** RES-06 Assign caregivers. Only active employees can be picked. */
export function CaregiversDialog({ resident, onClose }: { resident: ResidentDetail; onClose: () => void }) {
  const staff = useStaff();
  const save = useSaveResident(resident.id);
  const [picked, setPicked] = useState<string[]>(() => resident.caregivers.map((c) => c.id));
  const [search, setSearch] = useState('');
  const { error, run } = useAction(onClose);

  const employees = (staff.data ?? []).filter((s) => s.role === 'employee');
  const active = employees.filter((s) => s.isActive);
  const q = search.trim().toLowerCase();
  const shown = active.filter((s) => s.fullName.toLowerCase().includes(q));
  const deactivated = employees.filter((s) => !s.isActive);
  // Someone already assigned who was deactivated since is listed, so they can be unticked.
  const kept = deactivated.filter((s) => resident.caregivers.some((c) => c.id === s.id));
  const hidden = deactivated.filter((s) => !kept.includes(s));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Dialog open onClose={() => !save.isPending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Assign caregivers</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 3 }}>
          {resident.fullName}
          {resident.room ? ` · ${resident.room.name}` : ''}
        </DialogContentText>
        <ErrorAlert error={error} />
        <TextField
          size="small"
          fullWidth
          placeholder="Search employees"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            htmlInput: { 'aria-label': 'Search employees' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        {staff.isPending ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
            Loading employees…
          </Typography>
        ) : staff.isError ? (
          <Alert severity="error" sx={{ mt: 3 }}>
            {errorMessage(staff.error)}
          </Alert>
        ) : (
          <List dense aria-label="Employees" sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {[...kept, ...shown].map((s) => {
              const labelId = `caregiver-${s.id}`;
              return (
                <ListItem key={s.id} disablePadding>
                  <ListItemButton onClick={() => toggle(s.id)} dense>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        edge="start"
                        checked={picked.includes(s.id)}
                        tabIndex={-1}
                        disableRipple
                        slotProps={{ input: { 'aria-labelledby': labelId } }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      id={labelId}
                      primary={s.isActive ? s.fullName : `${s.fullName} (deactivated)`}
                      secondary={areasLabel(s)}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
            {shown.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                {active.length === 0
                  ? 'There are no active employees yet.'
                  : 'No employee matches your search.'}
              </Typography>
            )}
          </List>
        )}
        {hidden.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Deactivated accounts ({hidden.map((s) => s.fullName).join(', ')}) are not listed.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          loading={save.isPending}
          disabled={!staff.isSuccess}
          onClick={() =>
            void run(() => save.mutateAsync({ ...currentRequest(resident), caregiverIds: picked }))
          }
        >
          Save caregivers
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * RES-07 Archive resident. The resident leaves the lists and alerts but keeps their incident
 * history. The reason is only asked for when the server keeps it (serverFeatures.residentDetails).
 */
export function ArchiveDialog({ resident, onClose }: { resident: ResidentDetail; onClose: () => void }) {
  const archive = useArchiveResident(resident.id);
  const withReason = serverFeatures.residentDetails;
  const { error, run } = useAction(onClose);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ArchiveForm, unknown, ArchiveRequest>({
    resolver: zodResolver(archiveRequestSchema),
    defaultValues: { reason: 'moved_out', note: '' },
  });
  const reason = useWatch({ control, name: 'reason' });
  const submit = withReason
    ? handleSubmit((values) => run(() => archive.mutateAsync(values)))
    : () => run(() => archive.mutateAsync(null));

  return (
    <Dialog open onClose={() => !archive.isPending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Archive {resident.fullName}?</DialogTitle>
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <DialogContent sx={{ pt: 0 }}>
          <DialogContentText sx={{ mb: 4 }}>
            This resident will no longer appear in the resident lists or on new alerts. Their incident history
            is kept, and you can restore them later.
          </DialogContentText>
          <ErrorAlert error={error} />
          {withReason && (
            <>
              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <FormLabel id="archive-reason-label" required>
                      Reason
                    </FormLabel>
                    <RadioGroup aria-labelledby="archive-reason-label" {...field}>
                      {archiveReasonSchema.options.map((r) => (
                        <FormControlLabel
                          key={r}
                          value={r}
                          control={<Radio />}
                          label={ARCHIVE_REASON_LABEL[r]}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                )}
              />
              <TextField
                label={reason === 'other' ? 'Note' : 'Note (optional)'}
                required={reason === 'other'}
                fullWidth
                multiline
                minRows={2}
                error={!!errors.note}
                helperText={errors.note?.message ?? 'Required for Other.'}
                {...register('note')}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button onClick={onClose} disabled={archive.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" color="error" loading={archive.isPending}>
            Archive resident
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** RES-07 Restore an archived resident. */
export function RestoreDialog({ resident, onClose }: { resident: ResidentDetail; onClose: () => void }) {
  const restore = useRestoreResident(resident.id);
  const { error, run } = useAction(onClose);
  return (
    <Dialog open onClose={() => !restore.isPending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Restore {resident.fullName}?</DialogTitle>
      <DialogContent>
        <ErrorAlert error={error} />
        <DialogContentText>
          {resident.fullName} will appear in the resident lists again
          {resident.room ? `, in ${roomLabel(resident.room)}` : ''}. Check the room before restoring.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={restore.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          loading={restore.isPending}
          onClick={() => void run(() => restore.mutateAsync())}
        >
          Restore resident
        </Button>
      </DialogActions>
    </Dialog>
  );
}
