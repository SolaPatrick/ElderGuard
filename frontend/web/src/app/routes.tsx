import type { RouteObject } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { AppShell } from '../layout/AppShell';
import { LoginPage } from '../features/login/LoginPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AlertsQueuePage } from '../features/alerts/AlertsQueuePage';
import { AlertDetailPage } from '../features/alerts/AlertDetailPage';
import { IncidentListPage } from '../features/incidents/IncidentListPage';
import { MonitoringPage } from '../features/monitoring/MonitoringPage';
import { CameraPage } from '../features/monitoring/CameraPage';
import { ComingSoonPage } from '../features/system/ComingSoonPage';
import { NotFoundPage } from '../features/system/NotFoundPage';
import { RouteErrorPage } from '../features/system/RouteErrorPage';

const soon = (path: string, title: string): RouteObject => ({
  path,
  element: <ComingSoonPage title={title} />,
});

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorPage /> },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            errorElement: <RouteErrorPage />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'alerts', element: <AlertsQueuePage /> },
              { path: 'alerts/:code', element: <AlertDetailPage /> },
              { path: 'incidents', element: <IncidentListPage /> },
              { path: 'incidents/:code', element: <AlertDetailPage /> },
              { path: 'monitoring', element: <MonitoringPage /> },
              { path: 'monitoring/:code', element: <CameraPage /> },
              soon('residents', 'Residents'),
              soon('notifications', 'Notifications'),
              soon('help', 'Help & About'),
              {
                element: <RequireAuth roles={['admin']} />,
                children: [
                  soon('rooms', 'Rooms & areas'),
                  soon('cameras', 'Cameras & devices'),
                  soon('users', 'Users & access'),
                  soon('reports', 'Reports & analytics'),
                  soon('activity', 'Activity log'),
                  soon('settings', 'Settings'),
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
