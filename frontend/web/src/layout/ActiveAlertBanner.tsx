import { Box, Button, Typography } from '@mui/material';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import { Link as RouterLink } from 'react-router';
import { formatElapsed, formatShortDuration, secondsBetween, type Incident } from '@elderguard/shared';
import { useNow } from '../hooks/useNow';

/** SH-07: red bar under the top bar while any alert is still open. */
export function ActiveAlertBanner({ incidents, userId }: { incidents: Incident[]; userId?: string }) {
  const now = useNow();
  if (incidents.length === 0) return null;
  const oldest = incidents.reduce((a, b) => (Date.parse(a.detectedAt) <= Date.parse(b.detectedAt) ? a : b));
  const count = incidents.length;
  // SOS-02: the person who sent an open SOS sees it first, with a way back to it.
  const mine = userId ? incidents.find((i) => i.type === 'sos' && i.sentBy?.id === userId) : undefined;
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
        {mine
          ? `Your SOS is active · ${formatElapsed(secondsBetween(mine.detectedAt, now))} elapsed · ${count} active ${count === 1 ? 'alert' : 'alerts'}`
          : `${count} active ${count === 1 ? 'alert' : 'alerts'} · oldest unresolved for ${formatShortDuration(secondsBetween(oldest.detectedAt, now))}`}
      </Typography>
      <Button
        component={RouterLink}
        to={mine ? `/alerts/${mine.code}` : '/alerts'}
        variant="contained"
        size="small"
        sx={{
          bgcolor: 'background.paper',
          color: 'eg.sys.critical',
          '&:hover': { bgcolor: 'eg.sys.criticalContainer' },
        }}
      >
        {mine ? 'View SOS' : 'Go to alerts'}
      </Button>
    </Box>
  );
}
