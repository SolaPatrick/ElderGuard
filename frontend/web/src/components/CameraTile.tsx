import { Box, ButtonBase } from '@mui/material';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import VideocamOffOutlined from '@mui/icons-material/VideocamOffOutlined';
import PauseCircleOutlined from '@mui/icons-material/PauseCircleOutlined';
import PersonAlertIcon from '@mui/icons-material/PersonOutlined';
import { Link as RouterLink } from 'react-router';
import { formatTime, incidentTitle, type Camera, type Incident } from '@elderguard/shared';

const STATE_LABEL: Record<Camera['status'], string> = {
  online: 'LIVE',
  offline: 'OFFLINE',
  error: 'ERROR',
  paused: 'LIVE', // the feed is live; only fall detection is paused
  connecting: 'CONNECTING',
};

const tagSx = {
  px: 2,
  py: 0.5,
  borderRadius: 1,
  bgcolor: 'rgba(0,0,0,0.6)',
  color: 'eg.comp.cameraOverlayText',
  typography: 'caption',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1.5,
  width: 'fit-content',
} as const;

/** What the second chip on a tile says (MON-01). */
function detectionChip(camera: Camera, alert: Incident | null) {
  if (alert)
    return {
      text: incidentTitle(alert),
      sx: { bgcolor: 'eg.sys.critical', color: 'eg.sys.onCritical' },
      icon: <PersonAlertIcon sx={{ fontSize: 14 }} />,
    };
  if (camera.status === 'offline' || camera.status === 'error')
    return {
      text: camera.lastSeenAt ? `Last seen ${formatTime(camera.lastSeenAt)}` : 'Not seen yet',
      sx: {},
      icon: null,
    };
  if (!camera.detectionEnabled || camera.status === 'paused')
    return {
      text: 'Detection paused',
      sx: { bgcolor: 'eg.sys.warningContainer', color: 'eg.sys.onWarningContainer' },
      icon: <PauseCircleOutlined sx={{ fontSize: 14 }} />,
    };
  return { text: 'Detection on', sx: {}, icon: null };
}

/**
 * Dark camera preview. Used on the caregiver dashboard (compact) and in the
 * Live Monitoring grid (with detection status).
 */
export function CameraTile({
  camera,
  alert = null,
  to,
  height = 120,
  showDetection = false,
}: {
  camera: Camera;
  /** The open alert in this camera's room, if any. */
  alert?: Incident | null;
  to: string;
  height?: number | string;
  showDetection?: boolean;
}) {
  const working = camera.status === 'online' || camera.status === 'paused';
  const label = `${camera.code}${camera.roomName ? ` · ${camera.roomName}` : ''}`;
  const chip = detectionChip(camera, alert);
  const offline = camera.status === 'offline' || camera.status === 'error';

  return (
    <ButtonBase
      component={RouterLink}
      to={to}
      aria-label={`${label}, ${working ? 'live' : STATE_LABEL[camera.status].toLowerCase()}${alert ? ', alert active' : ''}`}
      sx={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        background: (t) =>
          `linear-gradient(180deg, ${(t.vars ?? t).palette.eg.sys.inverseSurface} 0%, ${(t.vars ?? t).palette.eg.comp.cameraWell} 100%)`,
        border: 3,
        borderColor: alert ? 'eg.comp.alertBorderNew' : 'transparent',
      }}
    >
      {working ? (
        <VideocamOutlined sx={{ fontSize: 36, color: 'rgba(255,255,255,0.35)' }} aria-hidden />
      ) : (
        <VideocamOffOutlined sx={{ fontSize: 36, color: 'rgba(255,255,255,0.7)' }} aria-hidden />
      )}
      <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'grid', gap: 1.5 }} aria-hidden>
        <Box
          sx={{
            ...tagSx,
            ...(offline && { bgcolor: 'eg.sys.neutralContainer', color: 'eg.sys.onNeutralContainer' }),
          }}
        >
          {offline ? (
            <VideocamOffOutlined sx={{ fontSize: 12 }} />
          ) : (
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                border: 1.5,
                borderColor: working ? 'eg.comp.inverseSuccess' : 'eg.comp.inverseWarning',
              }}
            />
          )}
          {STATE_LABEL[camera.status]}
        </Box>
        {showDetection && (
          <Box sx={{ ...tagSx, ...chip.sx }}>
            {chip.icon}
            {chip.text}
          </Box>
        )}
      </Box>
      <Box sx={{ ...tagSx, position: 'absolute', bottom: 8, left: 8 }} aria-hidden>
        {label}
      </Box>
    </ButtonBase>
  );
}
