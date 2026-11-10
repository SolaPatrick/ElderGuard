import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CANCEL_SOS_REASON_LABEL,
  cancelSosFormSchema,
  cancelSosReasonSchema,
  formatElapsed,
  formatTime,
  secondsBetween,
  type CancelSosForm,
  type CancelSosRequest,
  type IncidentDetail,
} from '@elderguard/shared';
import { useCancelSos } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { useNow } from '../../hooks/useNow';

/**
 * SOS-02 SOS active status, shown to the person who sent it. The servers record one responder
 * (who acknowledged), not who was notified, so the design's "who has been notified" list is left out.
 */
export function SosStatusCard({ incident, onCancel }: { incident: IncidentDetail; onCancel: () => void }) {
  const now = useNow();
  return (
    <Card sx={{ borderColor: 'eg.sys.critical', borderWidth: 2 }}>
      <CardContent sx={{ p: 5 }}>
        <Typography variant="h6" component="h2">
          Your SOS is active
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          {incident.room.name} · sent {formatTime(incident.detectedAt)}
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" component="div">
              Elapsed
            </Typography>
            <Typography variant="h5" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }} role="timer">
              {formatElapsed(secondsBetween(incident.detectedAt, now))}
            </Typography>
          </Grid>
          <Grid size={6}>
            <Typography variant="caption" color="text.secondary" component="div">
              Responding
            </Typography>
            <Typography variant="body1" component="p">
              {incident.acknowledgedBy
                ? `${incident.acknowledgedBy.fullName}${incident.acknowledgedAt ? ` · ${formatTime(incident.acknowledgedAt)}` : ''}`
                : 'Waiting for someone to respond'}
            </Typography>
          </Grid>
        </Grid>
        <Button variant="outlined" color="error" onClick={onCancel}>
          Cancel SOS
        </Button>
      </CardContent>
    </Card>
  );
}

/** SOS-03 Cancel SOS. The SOS closes with the reason as its outcome; a note is kept with the incident. */
export function CancelSosDialog({
  open,
  incident,
  onClose,
}: {
  open: boolean;
  incident: IncidentDetail;
  onClose: () => void;
}) {
  const cancel = useCancelSos(incident.code);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelSosForm, unknown, CancelSosRequest>({
    resolver: zodResolver(cancelSosFormSchema),
    defaultValues: { reason: 'mistake', note: '' },
  });
  const reason = useWatch({ control, name: 'reason' });
  const close = () => {
    if (cancel.isPending) return;
    reset();
    cancel.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <form noValidate onSubmit={handleSubmit((values) => cancel.mutate(values, { onSuccess: close }))}>
        <DialogTitle>Cancel SOS?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 4 }}>
            Everyone who sees alerts will see that this SOS was cancelled, and why.
          </DialogContentText>
          {cancel.isError && (
            <Alert severity="error" sx={{ mb: 4 }} role="alert">
              {errorMessage(cancel.error)}
            </Alert>
          )}
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <FormControl fullWidth sx={{ mb: 3 }}>
                <FormLabel id="cancel-sos-reason" required>
                  Reason
                </FormLabel>
                <RadioGroup aria-labelledby="cancel-sos-reason" {...field}>
                  {cancelSosReasonSchema.options.map((r) => (
                    <FormControlLabel
                      key={r}
                      value={r}
                      control={<Radio />}
                      label={CANCEL_SOS_REASON_LABEL[r]}
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
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button onClick={close} disabled={cancel.isPending}>
            Keep SOS active
          </Button>
          <Button type="submit" variant="contained" color="error" loading={cancel.isPending}>
            Cancel SOS
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
