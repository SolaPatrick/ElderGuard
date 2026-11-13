import { useState } from 'react';
import { Alert, Box, Drawer } from '@mui/material';
import { Outlet } from 'react-router';
import { numbers } from '@elderguard/shared';
import { useCurrentUser } from '../auth/authContext';
import { useActiveIncidents } from '../api/queries';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useFacilityName } from './facility';
import { ActiveAlertBanner } from './ActiveAlertBanner';
import { FallAlertOverlay } from './FallAlertOverlay';
import { isMaintenance } from '../components/errorMessage';
import { SessionTimeoutDialog } from './SessionTimeoutDialog';
import { useDesktopAlertNotifications } from '../features/alertSetup/useDesktopAlertNotifications';

/** SH-01 / SH-02: sidebar + top bar + alert banner around every signed-in page. */
export function AppShell() {
  const user = useCurrentUser();
  const facilityName = useFacilityName();
  const [navOpen, setNavOpen] = useState(false);
  const active = useActiveIncidents();
  const incidents = active.data ?? [];
  // Keep showing the last known alerts if a refresh fails, and say the connection is down.
  const connectionLost = active.isError && active.failureCount > 0;
  useDesktopAlertNotifications(active.data, user.id);

  const sidebar = <Sidebar user={user} alertCount={incidents.length} onNavigate={() => setNavOpen(false)} />;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: numbers.layout.sidebarWidth,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          height: '100vh',
        }}
      >
        {sidebar}
      </Box>
      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        sx={{ display: { lg: 'none' } }}
        slotProps={{ paper: { sx: { width: numbers.layout.sidebarWidth } } }}
      >
        {sidebar}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ position: 'sticky', top: 0, zIndex: (t) => t.zIndex.appBar }}>
          <TopBar
            user={user}
            facilityName={facilityName}
            connectionLost={connectionLost}
            onOpenNav={() => setNavOpen(true)}
          />
          {connectionLost && (
            <Alert severity="error" square sx={{ px: { xs: 3, md: 8 } }}>
              {isMaintenance(active.error)
                ? 'ElderGuard is under maintenance. New alerts will not appear until it is back, so do in-person rounds. Checking again…'
                : 'Cannot reach the ElderGuard server. New alerts will not appear until the connection is back. Retrying…'}
            </Alert>
          )}
          <ActiveAlertBanner incidents={incidents} userId={user.id} />
        </Box>
        <Box
          component="main"
          sx={{ flex: 1, px: { xs: 3, md: 8 }, py: { xs: 5, md: 8 }, maxWidth: 1440, width: '100%' }}
        >
          <Outlet />
        </Box>
      </Box>

      <FallAlertOverlay incidents={incidents} />
      <SessionTimeoutDialog />
    </Box>
  );
}
