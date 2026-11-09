import { Box, Button, Typography } from '@mui/material';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import { Link as RouterLink } from 'react-router';
import { formatShortDuration, secondsBetween, type Incident } from '@elderguard/shared';
import { useNow } from '../hooks/useNow';

/** SH-07: red bar under the top bar while any alert is still open. */
export function ActiveAlertBanner({ incidents }: { incidents: Incident[] }) {
  const now = useNow();
  if (incidents.length === 0) return null;
  const oldest = incidents.reduce((a, b) => (Date.parse(a.detectedAt) <= Date.parse(b.detectedAt) ? a : b));
  const count = incidents.length;
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        px: { xs: 3, md: 8 },
        py: 2.5,
        bgcolor: 'eg.comp.takeoverHeader',
        color: 'eg.comp.takeoverHeaderLabel',
      }}
    >
      <NotificationsActiveOutlined aria-hidden />
      <Typography variant="subtitle2" component="p" sx={{ flex: 1 }}>
        {count} active {count === 1 ? 'alert' : 'alerts'} · oldest unresolved for{' '}
        {formatShortDuration(secondsBetween(oldest.detectedAt, now))}
      </Typography>
      <Button
        component={RouterLink}
        to="/alerts"
        variant="contained"
        size="small"
        sx={{
          bgcolor: 'background.paper',
          color: 'eg.sys.critical',
          '&:hover': { bgcolor: 'eg.sys.criticalContainer' },
        }}
      >
        Go to alerts
      </Button>
    </Box>
  );
}
