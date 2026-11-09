import { Box, ButtonBase } from '@mui/material';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import VideocamOffOutlined from '@mui/icons-material/VideocamOffOutlined';
import { Link as RouterLink } from 'react-router';
import type { Camera } from '@elderguard/shared';

const STATE_LABEL: Record<Camera['status'], string> = {
  online: 'LIVE',
  offline: 'OFFLINE',
  error: 'ERROR',
  paused: 'PAUSED',
  connecting: 'CONNECTING',
};

/** Small dark camera preview used on the caregiver dashboard and in Live Monitoring. */
export function CameraTile({
  camera,
  alerting = false,
  to = '/monitoring',
  height = 120,
}: {
  camera: Camera;
  alerting?: boolean;
  to?: string;
  height?: number;
}) {
  const live = camera.status === 'online';
  const label = `${camera.code}${camera.roomName ? ` · ${camera.roomName}` : ''}`;
  const tag = {
    position: 'absolute',
    left: 8,
    px: 2,
    py: 0.5,
    borderRadius: 1,
    bgcolor: 'rgba(0,0,0,0.6)',
    color: 'eg.comp.cameraOverlayText',
    typography: 'caption',
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
  } as const;
  return (
    <ButtonBase
      component={RouterLink}
      to={to}
      aria-label={`${label}, ${live ? 'live' : STATE_LABEL[camera.status].toLowerCase()}${alerting ? ', alert active' : ''}`}
      sx={{
        position: 'relative',
        display: 'grid',
        placeItems: 'center',
        width: '100%',
        height,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'eg.comp.cameraWell',
        border: 3,
        borderColor: alerting ? 'eg.comp.alertBorderNew' : 'transparent',
      }}
    >
      {live ? (
        <VideocamOutlined sx={{ fontSize: 32, color: 'rgba(255,255,255,0.35)' }} aria-hidden />
      ) : (
        <VideocamOffOutlined sx={{ fontSize: 32, color: 'rgba(255,255,255,0.35)' }} aria-hidden />
      )}
      <Box sx={{ ...tag, top: 8 }} aria-hidden>
        <Box
          component="span"
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            border: 1.5,
            borderColor: live ? 'eg.comp.inverseSuccess' : 'eg.comp.inverseWarning',
          }}
        />
        {STATE_LABEL[camera.status]}
      </Box>
      <Box sx={{ ...tag, bottom: 8 }} aria-hidden>
        {label}
      </Box>
    </ButtonBase>
  );
}
