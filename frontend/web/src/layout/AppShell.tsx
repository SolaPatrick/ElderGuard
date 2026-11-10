import { useState } from 'react';
import { Alert, Box, Drawer } from '@mui/material';
import { Outlet } from 'react-router';
import { numbers } from '@elderguard/shared';
import { useCurrentUser } from '../auth/authContext';
import { useActiveIncidents } from '../api/queries';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ActiveAlertBanner } from './ActiveAlertBanner';
import { FallAlertOverlay } from './FallAlertOverlay';

const FACILITY_NAME = 'Demo Home for the Aged'; // TODO: load from GET /facility once the backend has it

/** SH-01 / SH-02: sidebar + top bar + alert banner around every signed-in page. */
export function AppShell() {
  const user = useCurrentUser();
  const [navOpen, setNavOpen] = useState(false);
  const active = useActiveIncidents();
  const incidents = active.data ?? [];
  // Keep showing the last known alerts if a refresh fails, and say the connection is down.
  const connectionLost = active.isError && active.failureCount > 0;

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
            facilityName={FACILITY_NAME}
            alertCount={incidents.length}
            connectionLost={connectionLost}
            onOpenNav={() => setNavOpen(true)}
          />
          {connectionLost && (
            <Alert severity="error" square sx={{ px: { xs: 3, md: 8 } }}>
              Cannot reach the ElderGuard server. New alerts will not appear until the connection is back.
              Retrying…
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
    </Box>
  );
}
