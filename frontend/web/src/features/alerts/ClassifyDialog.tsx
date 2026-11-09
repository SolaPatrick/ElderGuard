import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { classifyRequestSchema, type ClassifyRequest, type IncidentDetail } from '@elderguard/shared';
import { useClassify } from '../../api/queries';
import { FALSE_ALARM_REASONS } from './options';
import { errorMessage } from '../../components/errorMessage';

/** ALT-03 */
export function ClassifyDialog({
  open,
  incident,
  onClose,
}: {
  open: boolean;
  incident: IncidentDetail;
  onClose: () => void;
}) {
  const classify = useClassify(incident.code);
  const { control, handleSubmit, reset, formState } = useForm<ClassifyRequest>({
    resolver: zodResolver(classifyRequestSchema),
    defaultValues: { classification: 'confirmed', falseAlarmReason: '' },
  });
  const classification = useWatch({ control, name: 'classification' });

  const close = () => {
    reset();
    classify.reset();
    onClose();
  };

  const onSubmit = handleSubmit((values) =>
    classify.mutate(values.classification === 'confirmed' ? { classification: 'confirmed' } : values, {
      onSuccess: close,
    }),
  );

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>Classify alert</DialogTitle>
        <DialogContent>
          <Stack spacing={4}>
            <Controller
              name="classification"
              control={control}
              render={({ field }) => (
                <FormControl>
                  <FormLabel id="classification-label">What happened?</FormLabel>
                  <RadioGroup aria-labelledby="classification-label" {...field}>
                    <FormControlLabel
                      value="confirmed"
                      control={<Radio />}
                      label={incident.type === 'sos' ? 'Real emergency' : 'Confirmed fall'}
                    />
                    <FormControlLabel value="false_alarm" control={<Radio />} label="False alarm" />
                  </RadioGroup>
                </FormControl>
              )}
            />
            {classification === 'false_alarm' && (
              <Controller
                name="falseAlarmReason"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    select
                    label="Reason"
                    required
                    {...field}
                    value={field.value ?? ''}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? 'Helps improve detection'}
                  >
                    {FALSE_ALARM_REASONS.map((r) => (
                      <MenuItem key={r} value={r}>
                        {r}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            )}
            {classification === 'false_alarm' && (
              <FormHelperText>Marking it as a false alarm closes the alert.</FormHelperText>
            )}
            {classify.isError && <Alert severity="error">{errorMessage(classify.error)}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button variant="outlined" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={classify.isPending || formState.isSubmitting}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
