import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '@elderguard/shared';
import { useAuth } from './authContext';
import { AccessDeniedPage } from '../features/system/AccessDeniedPage';

/** Sends signed-out visitors to the login page and remembers where they were going. */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <CircularProgress aria-label="Loading your session" />
      </Box>
    );
  }
  if (state.status === 'anonymous') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search, reason: state.reason }}
      />
    );
  }
  // A temporary password must be changed before anything else works (the server refuses other requests).
  if (state.user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(state.user.role)) return <AccessDeniedPage />;
  return <Outlet />;
}
