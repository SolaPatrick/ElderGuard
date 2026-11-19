import { Box } from '@mui/material';
import { useRestZones } from '../api/queries';

/**
 * MON-01/MON-02: the camera's rest zones as faint outlines over its picture. `fit` must match the
 * picture's object-fit, so the outlines land on the same pixels: the SVG crops ("cover") or
 * letterboxes ("contain") exactly as the browser does. Shows nothing when the server has no zones.
 */
export function RestZoneOutlines({
  cameraId,
  size,
  fit,
}: {
  cameraId: string;
  size: { width: number; height: number } | null;
  fit: 'cover' | 'contain';
}) {
  const zones = useRestZones(cameraId);
  if (!size || !zones.data?.length) return null;
  const { width: w, height: h } = size;
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      data-testid="rest-zone-outlines"
      aria-hidden
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      {zones.data.map((z) => (
        <polygon
          key={z.id}
          points={z.points.map((p) => `${p.x * w},${p.y * h}`).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
        >
          <title>{z.name}</title>
        </polygon>
      ))}
    </Box>
  );
}
