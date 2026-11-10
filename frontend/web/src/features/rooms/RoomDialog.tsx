import { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { roomFormSchema, type RoomForm, type RoomRef, type RoomRequest } from '@elderguard/shared';
import { useSaveRoom } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';

/** ROOM-02 Add / edit room. `room` null = add. */
export function RoomDialog({
  room,
  wings,
  onClose,
  onSaved,
}: {
  room: RoomRef | null;
  /** Existing wings, offered as suggestions so the same wing isn't typed two ways. */
  wings: string[];
  onClose: () => void;
  onSaved?: (room: RoomRef) => void;
}) {
  const save = useSaveRoom(room?.id ?? null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RoomForm, unknown, RoomRequest>({
    resolver: zodResolver(roomFormSchema),
    defaultValues: { name: room?.name ?? '', wing: room?.wing ?? '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const saved = await save.mutateAsync(values);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setSubmitError(errorMessage(err));
    }
  });

  return (
    <Dialog open onClose={() => !save.isPending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{room ? 'Edit room' : 'Add room'}</DialogTitle>
      <Box component="form" noValidate onSubmit={onSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 4 }} role="alert">
              {submitError}
            </Alert>
          )}
          <Stack spacing={4} sx={{ pt: 2 }}>
            <TextField
              label="Name"
              required
              autoFocus
              placeholder="e.g. Room 107 or Dining Hall"
              error={!!errors.name}
              helperText={errors.name?.message ?? 'Must be unique within its wing.'}
              {...register('name')}
            />
            <Controller
              control={control}
              name="wing"
              render={({ field }) => (
                <Autocomplete
                  freeSolo
                  options={wings}
                  value={field.value}
                  inputValue={field.value}
                  onInputChange={(_, value) => field.onChange(value)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Wing / floor"
                      inputRef={field.ref}
                      onBlur={field.onBlur}
                      error={!!errors.wing}
                      helperText={
                        errors.wing?.message ?? 'Optional, e.g. East Wing. Leave empty for common areas.'
                      }
                    />
                  )}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={save.isPending}>
            Save room
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
