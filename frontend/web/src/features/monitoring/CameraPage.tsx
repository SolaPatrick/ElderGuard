import { useRef, type ReactNode } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Link,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import FullscreenOutlined from '@mui/icons-material/FullscreenOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import VideocamOffOutlined from '@mui/icons-material/VideocamOffOutlined';
import { Link as RouterLink, useParams } from 'react-router';
import {
  formatDate,
  formatTime,
  formatTimeWithSeconds,
  incidentTitle,
  type Camera,
} from '@elderguard/shared';
import { useActiveIncidents, useCameras, useIncidents, useResidents } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { useNow } from '../../hooks/useNow';
import { SectionCard } from '../dashboard/DashboardCards';
import { NotFoundPage } from '../system/NotFoundPage';
import { alertForCamera } from './cameraFilters';

const tag = {
  position: 'absolute',
  px: 2,
  py: 0.5,
  borderRadius: 1,
  bgcolor: 'rgba(0,0,0,0.6)',
  color: 'eg.comp.cameraOverlayText',
  typography: 'caption',
} as const;

/** The large live feed. Plays the backend's stream when there is one, otherwise a placeholder. */
function CameraFeed({ camera, alerting }: { camera: Camera; alerting: boolean }) {
  const now = useNow();
  const working = camera.status === 'online' || camera.status === 'paused';
  return (
    <Box
      sx={{
        position: 'relative',
        aspectRatio: '16 / 9',
        width: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'eg.comp.cameraWell',
        border: 3,
        borderColor: alerting ? 'eg.comp.alertBorderNew' : 'transparent',
      }}
    >
      {working && camera.liveUrl ? (
        <Box
          component="video"
          src={camera.liveUrl}
          autoPlay
          muted
          playsInline
          aria-label={`Live feed from ${camera.code}`}
          sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : working ? (
        <VideocamOutlined sx={{ fontSize: 64, color: 'rgba(255,255,255,0.35)' }} aria-hidden />
      ) : (
        <Stack sx={{ alignItems: 'center', color: 'eg.comp.cameraOverlayText', gap: 2 }}>
          <VideocamOffOutlined sx={{ fontSize: 64 }} aria-hidden />
          <Typography variant="body2">
            Camera {camera.status === 'error' ? 'has an error' : 'is offline'}
            {camera.lastSeenAt ? ` · last seen ${formatTime(camera.lastSeenAt)}` : ''}
          </Typography>
        </Stack>
      )}
      {working && (
        <>
          <Box sx={{ ...tag, top: 12, left: 12 }}>LIVE</Box>
          <Box sx={{ ...tag, top: 12, right: 12 }}>{formatTimeWithSeconds(new Date(now).toISOString())}</Box>
        </>
      )}
      <Box sx={{ ...tag, bottom: 12, left: 12 }}>Live feed · {camera.code}</Box>
    </Box>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Grid size={6}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        {label}
      </Typography>
      {children}
    </Grid>
  );
}

/** MON-02 Single camera view. */
export function CameraPage() {
  const { code = '' } = useParams();
  const cameras = useCameras();
  const residents = useResidents();
  const incidents = useIncidents();
  const active = useActiveIncidents();
  const feedRef = useRef<HTMLDivElement>(null);

  if (cameras.isPending) return <LoadingBlock label="Loading camera" />;
  if (cameras.isError) return <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />;

  // The list only holds cameras this user may see, so another area's camera is "not found".
  const camera = cameras.data.find((c) => c.code.toLowerCase() === code.toLowerCase());
  if (!camera) return <NotFoundPage />;

  const alert = alertForCamera(camera, active.data ?? []);
  const inRoom = (residents.data ?? []).filter((r) => r.room?.id === camera.roomId);
  const detections = (incidents.data ?? []).filter((i) => i.camera?.id === camera.id).slice(0, 5);
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to="/monitoring" color="inherit">
              Live Monitoring
            </Link>{' '}
            / {camera.code}
          </>
        }
        title={`${camera.code}${camera.roomName ? ` · ${camera.roomName}` : ''}`}
        actions={
          <>
            <Tooltip describeChild title="Snapshots will work once the live feed is connected">
              <span>
                <Button variant="outlined" startIcon={<PhotoCameraOutlined />} disabled>
                  Snapshot
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<FullscreenOutlined />}
              disabled={!fullscreenSupported}
              onClick={() => void feedRef.current?.requestFullscreen().catch(() => undefined)}
            >
              Fullscreen
            </Button>
          </>
        }
      />

      <Grid container spacing={5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box ref={feedRef} sx={{ bgcolor: 'eg.comp.cameraWell', borderRadius: 2 }}>
            <CameraFeed camera={camera} alerting={alert !== null} />
          </Box>
          {alert && (
            <Card sx={{ mt: 4, bgcolor: 'eg.comp.alertWashNew', borderColor: 'eg.comp.alertBorderNew' }}>
              <CardContent sx={{ p: 4, display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ flex: 1, fontWeight: 600 }}>
                  {incidentTitle(alert)} · {alert.code}
                </Typography>
                <Button variant="contained" color="error" component={RouterLink} to={`/alerts/${alert.code}`}>
                  Open alert
                </Button>
              </CardContent>
            </Card>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={5}>
            <SectionCard title="Camera">
              <Grid container rowSpacing={4} columnSpacing={3}>
                <Fact label="Room">
                  <Typography variant="body2">
                    {camera.roomName ?? 'Not assigned'}
                    {camera.roomWing ? ` · ${camera.roomWing}` : ''}
                  </Typography>
                </Fact>
                <Fact label="Status">
                  <StatusChip kind="camera" status={camera.status} />
                </Fact>
                <Fact label="Fall detection">
                  <Typography variant="body2">
                    {camera.detectionEnabled && camera.status !== 'paused' ? 'On' : 'Paused'}
                  </Typography>
                </Fact>
                <Fact label="Stream">
                  <Typography variant="body2">{camera.resolutionFps ?? 'Unknown'}</Typography>
                </Fact>
              </Grid>
            </SectionCard>

            <SectionCard title="Residents in this room">
              {residents.isPending ? (
                <SkeletonRows rows={2} />
              ) : inRoom.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No residents are assigned to this room.
                </Typography>
              ) : (
                <List dense disablePadding aria-label="Residents in this room">
                  {inRoom.map((r) => (
                    <ListItem
                      key={r.id}
                      disableGutters
                      secondaryAction={<StatusChip kind="risk" risk={r.fallRisk} />}
                    >
                      <ListItemText
                        primary={r.fullName}
                        secondary={r.age !== null ? `Age ${r.age}` : undefined}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </SectionCard>

            <SectionCard title="Recent detections">
              {incidents.isPending ? (
                <SkeletonRows rows={2} />
              ) : detections.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No detections from this camera yet.
                </Typography>
              ) : (
                <List dense disablePadding aria-label="Recent detections">
                  {detections.map((i) => (
                    <ListItem
                      key={i.code}
                      disableGutters
                      secondaryAction={<StatusChip kind="incident" status={i.status} />}
                    >
                      <ListItemText
                        primary={
                          <Link component={RouterLink} to={`/incidents/${i.code}`}>
                            {i.code}
                          </Link>
                        }
                        secondary={`${formatDate(i.detectedAt)}, ${formatTime(i.detectedAt)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
