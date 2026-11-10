import type { RouteObject } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { AppShell } from '../layout/AppShell';
import { LoginPage } from '../features/login/LoginPage';
import { ChangePasswordPage } from '../features/login/ChangePasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { AlertsQueuePage } from '../features/alerts/AlertsQueuePage';
import { AlertDetailPage } from '../features/alerts/AlertDetailPage';
import { IncidentListPage } from '../features/incidents/IncidentListPage';
import { MonitoringPage } from '../features/monitoring/MonitoringPage';
import { CameraPage } from '../features/monitoring/CameraPage';
import { ResidentsPage } from '../features/residents/ResidentsPage';
import { ResidentProfilePage } from '../features/residents/ResidentProfilePage';
import { UsersPage } from '../features/users/UsersPage';
import { CreateUserPage } from '../features/users/CreateUserPage';
import { UserDetailPage } from '../features/users/UserDetailPage';
import { EditUserPage } from '../features/users/EditUserPage';
import { RoomsPage } from '../features/rooms/RoomsPage';
import { RoomDetailPage } from '../features/rooms/RoomDetailPage';
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
      { path: '/change-password', element: <ChangePasswordPage /> },
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
              { path: 'residents', element: <ResidentsPage /> },
              { path: 'residents/:id', element: <ResidentProfilePage /> },
              soon('notifications', 'Notifications'),
              soon('help', 'Help & About'),
              {
                element: <RequireAuth roles={['admin']} />,
                children: [
                  { path: 'rooms', element: <RoomsPage /> },
                  { path: 'rooms/:id', element: <RoomDetailPage /> },
                  soon('cameras', 'Cameras & devices'),
                  { path: 'users', element: <UsersPage /> },
                  { path: 'users/new', element: <CreateUserPage /> },
                  { path: 'users/:id', element: <UserDetailPage /> },
                  { path: 'users/:id/edit', element: <EditUserPage /> },
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
