import { useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { type Camera } from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { useActiveIncidents, useCameraSettings, useCameras, useDeleteCamera } from '../../api/queries';
import { CameraTile } from '../../components/CameraTile';
import { errorMessage } from '../../components/errorMessage';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { SectionCard } from '../dashboard/DashboardCards';
import { alertForCamera } from '../monitoring/cameraFilters';
import { NotFoundPage } from '../system/NotFoundPage';
import { lastSeenLabel } from './cameraLabels';

const BLUR = { off: 'Off', person: 'People are blurred', whole: 'Whole picture is blurred' } as const;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ wordBreak: 'break-all' }}>
        {children}
      </Typography>
    </Grid>
  );
}

/** CAM-07 Remove camera. The server refuses when the camera has alerts in the incident history. */
function RemoveCameraDialog({ camera, onClose }: { camera: Camera; onClose: () => void }) {
  const navigate = useNavigate();
  const remove = useDeleteCamera(camera.id);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync();
      onClose();
      void navigate('/cameras', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Dialog open onClose={() => !remove.isPending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Remove {camera.code}?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} role="alert">
            {error}
          </Alert>
        )}
        <Typography>
          {camera.roomName ? `${camera.roomName} will no longer be watched by ${camera.code}. ` : ''}A camera
          with alerts in the incident history can't be removed; turn its fall detection off instead.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={remove.isPending}>
          Cancel
        </Button>
        <Button variant="contained" color="error" loading={remove.isPending} onClick={() => void confirm()}>
          Remove camera
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** CAM-03 Camera detail (Admin/Head). */
export function CameraDetailPage() {
  const { id = '' } = useParams();
  const cameras = useCameras();
  const settings = useCameraSettings(id);
  const active = useActiveIncidents();
  const [removing, setRemoving] = useState(false);

  if (cameras.isPending || settings.isPending) return <LoadingBlock label="Loading camera" />;
  if (settings.isError) {
    if (settings.error instanceof ApiError && settings.error.status === 404) return <NotFoundPage />;
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />;
  }
  if (cameras.isError) return <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />;
  const camera = cameras.data.find((c) => c.id === id);
  if (!camera) return <NotFoundPage />;
  const s = settings.data;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to="/cameras" color="inherit">
              Cameras &amp; Devices
            </Link>{' '}
            / {camera.code}
          </>
        }
        title={camera.roomName ? `${camera.code} · ${camera.roomName}` : camera.code}
        subtitle={`Last seen: ${lastSeenLabel(camera)}`}
        actions={
          <>
            <Button variant="outlined" component={RouterLink} to={`/cameras/${camera.id}/edit`}>
              Edit configuration
            </Button>
            <Button variant="outlined" color="error" onClick={() => setRemoving(true)}>
              Remove camera
            </Button>
          </>
        }
      />

      <Grid container spacing={5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Stack spacing={3}>
            <CameraTile
              camera={camera}
              alert={alertForCamera(camera, active.data ?? [])}
              to={`/monitoring/${camera.code}`}
              height={320}
              showDetection
            />
            <Typography variant="body2" color="text.secondary">
              Select the picture to open the full live view.
            </Typography>
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Configuration" action={<StatusChip kind="camera" status={camera.status} />}>
            <Grid container rowSpacing={4} columnSpacing={3}>
              <Fact label="Stream">{s.source}</Fact>
              <Fact label="Picture">{camera.resolutionFps ?? '—'}</Fact>
              <Fact label="Room / area">
                {camera.roomName ? (
                  <Link component={RouterLink} to={`/rooms/${camera.roomId}`}>
                    {camera.roomWing ? `${camera.roomName} · ${camera.roomWing}` : camera.roomName}
                  </Link>
                ) : (
                  'No room yet'
                )}
              </Fact>
              <Fact label="Covers">{s.place === 'bathroom' ? 'A bathroom' : 'A room or common area'}</Fact>
              <Fact label="Privacy blur">{BLUR[s.privacyBlur]}</Fact>
              <Fact label="Fall detection">{s.detectionEnabled ? 'On' : 'Off'}</Fact>
            </Grid>
          </SectionCard>
        </Grid>
      </Grid>

      {removing && <RemoveCameraDialog camera={camera} onClose={() => setRemoving(false)} />}
    </>
  );
}
