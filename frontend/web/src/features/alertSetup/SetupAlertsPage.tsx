import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router';
import { useCurrentUser } from '../../auth/authContext';
import { BrandMark } from '../../components/BrandMark';
import {
  AlarmVolumeSlider,
  NotificationAccessChip,
  NotificationAccessHelp,
  TestAlarmButton,
} from './AlertControls';
import { markAlertSetupDone } from './alertPrefs';
import { useNotificationAccess } from './desktopNotifications';

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 4 }}
    >
      <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      <Stack spacing={3}>{children}</Stack>
    </Box>
  );
}

/**
 * AUTH-07: shown after logging in, until the user has done it once on this computer.
 * Asks for desktop notifications and lets the user check that the alarm can be heard.
 */
export function SetupAlertsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const access = useNotificationAccess();

  const start = () => {
    markAlertSetupDone(user.id);
    void navigate(from && from !== '/setup-alerts' ? from : '/', { replace: true });
  };

  return (
    <Box
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 4, bgcolor: 'background.default' }}
    >
      <Card sx={{ width: '100%', maxWidth: 640, borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 5, sm: 8 } }}>
          <Stack direction="row" spacing={3} sx={{ alignItems: 'center', mb: 6 }}>
            <BrandMark tonal />
            <Typography variant="h6" component="div">
              ElderGuard
            </Typography>
          </Stack>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 2 }}>
            Before you start monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
            Make sure you will notice a fall alert. Allow notifications so alerts reach you when this tab is
            in the background, and play the alarm once to check that you can hear it.
          </Typography>

          <Stack spacing={4}>
            <Step title="1. Allow browser notifications">
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="body2">Browser permission</Typography>
                <NotificationAccessChip access={access} />
              </Stack>
              <NotificationAccessHelp access={access} />
            </Step>
            <Step title="2. Play test alarm">
              <Typography variant="body2" color="text.secondary">
                Turn up your speakers. The alarm sounds like this when a fall is detected and repeats until
                someone acknowledges it.
              </Typography>
              <AlarmVolumeSlider />
              <TestAlarmButton />
            </Step>
            <Button variant="contained" size="large" onClick={start}>
              Start monitoring
            </Button>
            <Typography variant="caption" color="text.secondary">
              You can change these later under Alert preferences in the account menu. ElderGuard is an
              assistive tool. It does not replace rounds and in-person checks.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
