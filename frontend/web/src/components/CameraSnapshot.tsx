import { Box } from '@mui/material';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';

/**
 * Camera evidence well. Shows the snapshot when the backend provides one,
 * otherwise a dark placeholder like the mockups.
 */
export function CameraSnapshot({
  src,
  timeLabel,
  caption,
  alerting = false,
  minHeight = 240,
}: {
  src: string | null;
  timeLabel: string;
  caption: string;
  alerting?: boolean;
  minHeight?: number;
}) {
  const tag = {
    position: 'absolute',
    px: 2,
    py: 0.5,
    borderRadius: 1,
    bgcolor: 'rgba(0,0,0,0.6)',
    color: 'eg.comp.cameraOverlayText',
    typography: 'caption',
  } as const;
  return (
    <Box
      sx={{
        position: 'relative',
        minHeight,
        height: '100%',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'eg.comp.cameraWell',
        border: 3,
        borderColor: alerting ? 'eg.comp.alertBorderNew' : 'transparent',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {src ? (
        <Box
          component="img"
          src={src}
          alt={caption}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <VideocamOutlined sx={{ fontSize: 40, color: 'rgba(255,255,255,0.4)' }} aria-hidden />
      )}
      <Box sx={{ ...tag, top: 8, left: 8 }}>{timeLabel}</Box>
      <Box sx={{ ...tag, bottom: 8, left: 8 }}>{caption}</Box>
    </Box>
  );
}
