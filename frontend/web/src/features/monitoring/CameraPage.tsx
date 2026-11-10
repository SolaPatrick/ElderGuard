import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
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
import { ApiError } from '../../api/client';
import {
  hasLiveVideo,
  useActiveIncidents,
  useCameraPictureQuery,
  useCameras,
  useIncidents,
  useResidents,
} from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { errorMessage } from '../../components/errorMessage';
import { useNow } from '../../hooks/useNow';
import { usePageVisible } from '../../hooks/usePageVisible';
import { SectionCard } from '../dashboard/DashboardCards';
import { NotFoundPage } from '../system/NotFoundPage';
import { alertForCamera } from './cameraFilters';
import { useCameraSnapshot } from './snapshot';

const tag = {
  position: 'absolute',
  px: 2,
  py: 0.5,
  borderRadius: 1,
  bgcolor: 'rgba(0,0,0,0.6)',
  color: 'eg.comp.cameraOverlayText',
  typography: 'caption',
} as const;

/** Seconds before a stopped stream tries again on its own. */
const RECONNECT_SECONDS = 5;

function FeedMessage({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Stack
      sx={{ alignItems: 'center', color: 'eg.comp.cameraOverlayText', gap: 2, px: 4, textAlign: 'center' }}
    >
      {icon}
      {children}
    </Stack>
  );
}

/**
 * The large live feed. Plays the backend's stream when there is one, otherwise a placeholder.
 * The stream stops while the tab is hidden, and reconnects on its own if it breaks.
 */
function CameraFeed({ camera, alerting }: { camera: Camera; alerting: boolean }) {
  const now = useNow();
  const visible = usePageVisible();
  // Each try at the stream: its number (the <img> key) and when it started.
  const [attempt, setAttempt] = useState({ n: 0, at: 0 });
  const [failedAttempt, setFailedAttempt] = useState<number | null>(null);
  const working = camera.status === 'online' || camera.status === 'paused';
  const stream = working ? camera.liveUrl : null;
  const retry = () => setAttempt((a) => ({ n: a.n + 1, at: Date.now() }));

  // A browser keeps showing the last frame when an MJPEG stream breaks, with no error event. So the
  // page also asks for the newest picture every few seconds: if the server stops answering, the
  // stream counts as stopped. Only a lost server counts; a server without pictures is not a broken stream.
  const check = useCameraPictureQuery(camera, stream !== null && visible && failedAttempt !== attempt.n);
  const serverLost =
    check.isError &&
    check.errorUpdatedAt > attempt.at &&
    (!(check.error instanceof ApiError) || check.error.status === 0 || check.error.status >= 500);
  const failed = stream !== null && (failedAttempt === attempt.n || serverLost);

  useEffect(() => {
    if (!failed || !visible) return;
    const id = window.setTimeout(retry, RECONNECT_SECONDS * 1000);
    return () => window.clearTimeout(id);
  }, [failed, visible, attempt.n]);

  const onError = () => setFailedAttempt(attempt.n);
  const feedSx = { width: '100%', height: '100%', objectFit: 'contain' } as const;
  const nowIso = new Date(now).toISOString();

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
      {stream && failed ? (
        <FeedMessage icon={<VideocamOffOutlined sx={{ fontSize: 64 }} aria-hidden />}>
          <Typography variant="body2" role="status">
            The live video stopped. Trying again in a few seconds.
          </Typography>
          <Button variant="contained" size="small" onClick={retry}>
            Reconnect now
          </Button>
        </FeedMessage>
      ) : stream && !visible ? (
        <FeedMessage icon={<VideocamOutlined sx={{ fontSize: 64 }} aria-hidden />}>
          <Typography variant="body2">Live video is paused while this tab is hidden.</Typography>
        </FeedMessage>
      ) : stream && camera.liveFormat === 'mjpeg' ? (
        <Box
          key={attempt.n}
          component="img"
          src={stream}
          alt={`Live feed from ${camera.code}`}
          onError={onError}
          sx={feedSx}
        />
      ) : stream ? (
        <Box
          key={attempt.n}
          component="video"
          src={stream}
          autoPlay
          muted
          playsInline
          aria-label={`Live feed from ${camera.code}`}
          onError={onError}
          sx={feedSx}
        />
      ) : working ? (
        <FeedMessage
          icon={<VideocamOutlined sx={{ fontSize: 64, color: 'rgba(255,255,255,0.35)' }} aria-hidden />}
        >
          <Typography variant="body2">
            {camera.status === 'paused'
              ? 'No live video while fall detection is paused.'
              : 'Live video is not connected for this camera yet.'}
          </Typography>
        </FeedMessage>
      ) : (
        <FeedMessage icon={<VideocamOffOutlined sx={{ fontSize: 64 }} aria-hidden />}>
          <Typography variant="body2">
            Camera {camera.status === 'error' ? 'has an error' : 'is offline'}
            {camera.lastSeenAt ? ` · last seen ${formatTime(camera.lastSeenAt)}` : ''}
          </Typography>
        </FeedMessage>
      )}
      {stream && !failed && visible && (
        <>
          <Box sx={{ ...tag, top: 12, left: 12 }}>LIVE</Box>
          <Box sx={{ ...tag, top: 12, right: 12 }}>
            {formatTimeWithSeconds(nowIso)} · {formatDate(nowIso)}
          </Box>
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
  const snapshot = useCameraSnapshot();

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
            {hasLiveVideo(camera) ? (
              <Button
                variant="outlined"
                startIcon={<PhotoCameraOutlined />}
                loading={snapshot.isPending}
                onClick={() => snapshot.mutate(camera)}
              >
                Snapshot
              </Button>
            ) : (
              <Tooltip describeChild title="Snapshots need live video from this camera">
                <span>
                  <Button variant="outlined" startIcon={<PhotoCameraOutlined />} disabled>
                    Snapshot
                  </Button>
                </span>
              </Tooltip>
            )}
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

      {snapshot.isError && (
        <Alert severity="error" role="alert" onClose={() => snapshot.reset()} sx={{ mb: 5 }}>
          Couldn't save a snapshot. {errorMessage(snapshot.error)}
        </Alert>
      )}

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
