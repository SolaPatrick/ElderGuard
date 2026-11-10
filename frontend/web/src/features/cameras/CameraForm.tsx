import { useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  cameraFormSchema,
  type Camera,
  type CameraForm as CameraFormValues,
  type CameraRequest,
} from '@elderguard/shared';
import { useRooms, useTestCameraSource } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { roomLabel } from '../rooms/roomStats';

export const CAMERA_FORM_ID = 'camera-form';

const BLUR_LABEL = {
  off: 'Off',
  person: 'Blur people',
  whole: 'Blur the whole picture',
} as const;

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

/** "Test connection" (CAM-02 Testing / Test success / Test failed). Reads one picture from the source. */
function ConnectionTest({ source }: { source: string }) {
  const test = useTestCameraSource();
  const [tested, setTested] = useState<string | null>(null);
  const current = tested === source.trim();

  return (
    <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
      <Button
        variant="outlined"
        loading={test.isPending}
        disabled={source.trim() === ''}
        onClick={() => {
          setTested(source.trim());
          test.mutate(source.trim());
        }}
      >
        {test.isSuccess || test.isError ? 'Test again' : 'Test connection'}
      </Button>
      {current && test.isSuccess && (
        <Alert severity="success" variant="outlined" role="status" sx={{ width: '100%' }}>
          Connected · {test.data.width} × {test.data.height}
        </Alert>
      )}
      {current && test.isError && (
        <Alert severity="error" variant="outlined" role="status" sx={{ width: '100%' }}>
          <strong>Could not reach this stream.</strong> {errorMessage(test.error)}
        </Alert>
      )}
      {!current && (test.isSuccess || test.isError) && (
        <Typography variant="body2" color="text.secondary">
          The link changed since the last test.
        </Typography>
      )}
    </Stack>
  );
}

/** CAM-02 Register camera and CAM-04 Edit camera. The page puts the submit button in its header. */
export function CameraForm({
  initial,
  cameras,
  editingId = null,
  onSubmit,
  submitError,
}: {
  initial: CameraFormValues;
  /** All cameras, to warn about a duplicate name and a room that already has a camera. */
  cameras: Camera[];
  editingId?: string | null;
  onSubmit: (values: CameraRequest) => Promise<void>;
  submitError: string | null;
}) {
  const rooms = useRooms();
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CameraFormValues, unknown, CameraRequest>({
    resolver: zodResolver(cameraFormSchema),
    defaultValues: initial,
  });
  const [source, roomId, place] = useWatch({ control, name: ['source', 'roomId', 'place'] });
  const others = cameras.filter((c) => c.id !== editingId);
  const sharing = others.filter((c) => roomId !== '' && c.roomId === roomId);

  return (
    <Box
      component="form"
      id={CAMERA_FORM_ID}
      noValidate
      onSubmit={handleSubmit(async (values) => {
        // Names are used in links (/monitoring/CAM-01), so two cameras can't share one.
        if (others.some((c) => c.code.toLowerCase() === values.code.toLowerCase())) {
          setError('code', { message: `There is already a camera called ${values.code}.` });
          return;
        }
        await onSubmit(values);
      })}
    >
      <Stack spacing={5} sx={{ maxWidth: 760 }}>
        {submitError && (
          <Alert severity="error" role="alert">
            {submitError}
          </Alert>
        )}

        <Section title="Camera">
          <Stack spacing={4}>
            <TextField
              label="Name"
              required
              placeholder="CAM-12"
              error={!!errors.code}
              helperText={errors.code?.message ?? 'Shown on alerts and in Live Monitoring.'}
              {...register('code')}
            />
            <TextField
              label="Stream link or device number"
              required
              autoComplete="off"
              placeholder="rtsp://192.168.10.32:554/stream1"
              error={!!errors.source}
              helperText={
                errors.source?.message ??
                'An rtsp:// or http:// link, or 0, 1 … for a camera plugged into the server. Only admins can see it.'
              }
              {...register('source')}
            />
            <ConnectionTest source={source} />
          </Stack>
        </Section>

        <Section title="Placement">
          <Stack spacing={4}>
            <Controller
              control={control}
              name="roomId"
              render={({ field }) => (
                <TextField
                  select
                  label="Room / area"
                  {...field}
                  slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                  helperText={
                    sharing.length > 0
                      ? `${sharing.map((c) => c.code).join(', ')} already ${sharing.length === 1 ? 'monitors' : 'monitor'} this room. Both cameras will watch it, and an alert names the camera that saw the fall.`
                      : rooms.isError
                        ? 'Could not load the rooms. Reload the page to try again.'
                        : 'A camera without a room streams but its alerts have no location.'
                  }
                >
                  <MenuItem value="">No room yet</MenuItem>
                  {(rooms.data ?? []).map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {roomLabel(r)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="place"
              render={({ field }) => (
                <TextField
                  select
                  label="Camera covers"
                  {...field}
                  helperText="Bathroom cameras always blur the whole picture, for privacy."
                >
                  <MenuItem value="room">A room or common area</MenuItem>
                  <MenuItem value="bathroom">A bathroom</MenuItem>
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="privacyBlur"
              render={({ field }) => (
                <TextField
                  select
                  label="Privacy blur"
                  {...field}
                  value={place === 'bathroom' ? 'whole' : field.value}
                  disabled={place === 'bathroom'}
                  helperText={
                    place === 'bathroom'
                      ? 'Bathroom cameras always blur the whole picture.'
                      : 'What staff see in the live view and snapshots.'
                  }
                >
                  {(['off', 'person', 'whole'] as const).map((b) => (
                    <MenuItem key={b} value={b}>
                      {BLUR_LABEL[b]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="detectionEnabled"
              render={({ field }) => (
                <Box>
                  <FormControlLabel
                    control={
                      <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    }
                    label="Fall detection"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Turn off for a camera that should only stream. Falls it sees won't raise alerts.
                  </Typography>
                </Box>
              )}
            />
          </Stack>
        </Section>
      </Stack>
    </Box>
  );
}
