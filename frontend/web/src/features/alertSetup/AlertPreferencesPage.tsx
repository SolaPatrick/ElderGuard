import { Grid, Stack, Typography } from '@mui/material';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../dashboard/DashboardCards';
import {
  AlarmVolumeSlider,
  NotificationAccessChip,
  NotificationAccessHelp,
  TestAlarmButton,
} from './AlertControls';
import { useNotificationAccess } from './desktopNotifications';

/** PRF-03: desktop notifications and alarm volume for this computer. */
export function AlertPreferencesPage() {
  const access = useNotificationAccess();
  return (
    <>
      <PageHeader breadcrumb="My profile / Alert preferences" title="My alert preferences" />
      <Grid container spacing={5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Desktop notifications">
            <Stack spacing={3}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Browser permission
                </Typography>
                <NotificationAccessChip access={access} />
              </Stack>
              <NotificationAccessHelp access={access} />
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Alarm sound">
            <Stack spacing={3}>
              <AlarmVolumeSlider />
              <TestAlarmButton />
              <Typography variant="body2" color="text.secondary">
                These settings only change this computer and this browser.
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
