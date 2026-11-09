import { Box } from '@mui/material';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';

export function BrandMark({ size = 40, tonal = false }: { size?: number; tonal?: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        display: 'grid',
        placeItems: 'center',
        bgcolor: tonal ? 'eg.sys.primaryContainer' : 'eg.sys.primary',
        color: tonal ? 'eg.sys.onPrimaryContainer' : 'eg.sys.onPrimary',
        flexShrink: 0,
      }}
    >
      <ShieldOutlined sx={{ fontSize: size * 0.6 }} />
    </Box>
  );
}
