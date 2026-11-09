import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addNoteRequestSchema, type AddNoteRequest, type IncidentDetail } from '@elderguard/shared';
import { useAddNote } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';

/** INC-05 */
export function AddNoteDialog({
  open,
  incident,
  onClose,
}: {
  open: boolean;
  incident: IncidentDetail;
  onClose: () => void;
}) {
  const addNote = useAddNote(incident.code);
  const { register, handleSubmit, reset, formState } = useForm<AddNoteRequest>({
    resolver: zodResolver(addNoteRequestSchema),
    defaultValues: { body: '' },
  });

  const close = () => {
    reset();
    addNote.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit((values) => addNote.mutate(values, { onSuccess: close }))} noValidate>
        <DialogTitle>Add response note</DialogTitle>
        <DialogContent>
          <TextField
            label="Note"
            multiline
            minRows={4}
            autoFocus
            sx={{ mt: 1 }}
            error={!!formState.errors.body}
            helperText={formState.errors.body?.message}
            {...register('body')}
          />
          {addNote.isError && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {errorMessage(addNote.error)}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button variant="outlined" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={addNote.isPending}>
            Save note
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
