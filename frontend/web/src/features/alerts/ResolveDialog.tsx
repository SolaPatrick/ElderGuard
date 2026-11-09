import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resolveRequestSchema, type IncidentDetail, type ResolveRequest } from '@elderguard/shared';
import { useResolve } from '../../api/queries';
import { OUTCOMES } from './options';
import { errorMessage } from '../../components/errorMessage';

/** ALT-04 */
export function ResolveDialog({
  open,
  incident,
  onClose,
}: {
  open: boolean;
  incident: IncidentDetail;
  onClose: () => void;
}) {
  const resolve = useResolve(incident.code);
  const { control, handleSubmit, reset } = useForm<ResolveRequest>({
    resolver: zodResolver(resolveRequestSchema),
    defaultValues: { outcome: '', responseSummary: '' },
  });

  const close = () => {
    reset();
    resolve.reset();
    onClose();
  };

  const onSubmit = handleSubmit((values) =>
    resolve.mutate(
      {
        outcome: values.outcome,
        ...(values.responseSummary ? { responseSummary: values.responseSummary } : {}),
      },
      { onSuccess: close },
    ),
  );

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>Resolve incident</DialogTitle>
        <DialogContent>
          <Stack spacing={4} sx={{ pt: 1 }}>
            <Controller
              name="outcome"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  select
                  label="Outcome"
                  required
                  {...field}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {OUTCOMES.map((o) => (
                    <MenuItem key={o} value={o}>
                      {o}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="responseSummary"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  label="What was done (optional)"
                  multiline
                  minRows={3}
                  {...field}
                  value={field.value ?? ''}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            {resolve.isError && <Alert severity="error">{errorMessage(resolve.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button variant="outlined" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={resolve.isPending}>
            Resolve
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
