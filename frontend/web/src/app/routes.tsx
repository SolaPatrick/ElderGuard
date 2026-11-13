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
import { AddResidentPage, EditResidentPage } from '../features/residents/ResidentFormPages';
import { UsersPage } from '../features/users/UsersPage';
import { CreateUserPage } from '../features/users/CreateUserPage';
import { UserDetailPage } from '../features/users/UserDetailPage';
import { EditUserPage } from '../features/users/EditUserPage';
import { RoomsPage } from '../features/rooms/RoomsPage';
import { RoomDetailPage } from '../features/rooms/RoomDetailPage';
import { CamerasPage } from '../features/cameras/CamerasPage';
import { CameraDetailPage } from '../features/cameras/CameraDetailPage';
import { EditCameraPage, RegisterCameraPage } from '../features/cameras/CameraPages';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { HelpPage } from '../features/help/HelpPage';
import { SetupAlertsPage } from '../features/alertSetup/SetupAlertsPage';
import { AlertPreferencesPage } from '../features/alertSetup/AlertPreferencesPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { ActivityLogPage } from '../features/activity/ActivityLogPage';
import { GenerateReportPage } from '../features/reports/GenerateReportPage';
import { ReportPreviewPage } from '../features/reports/ReportPreviewPage';
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
      { path: '/setup-alerts', element: <SetupAlertsPage /> },
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
              { path: 'notifications', element: <NotificationsPage /> },
              { path: 'help', element: <HelpPage /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'profile/alerts', element: <AlertPreferencesPage /> },
              {
                element: <RequireAuth roles={['admin']} />,
                children: [
                  { path: 'residents/new', element: <AddResidentPage /> },
                  { path: 'residents/:id/edit', element: <EditResidentPage /> },
                  { path: 'rooms', element: <RoomsPage /> },
                  { path: 'rooms/:id', element: <RoomDetailPage /> },
                  { path: 'cameras', element: <CamerasPage /> },
                  { path: 'cameras/new', element: <RegisterCameraPage /> },
                  { path: 'cameras/:id', element: <CameraDetailPage /> },
                  { path: 'cameras/:id/edit', element: <EditCameraPage /> },
                  { path: 'users', element: <UsersPage /> },
                  { path: 'users/new', element: <CreateUserPage /> },
                  { path: 'users/:id', element: <UserDetailPage /> },
                  { path: 'users/:id/edit', element: <EditUserPage /> },
                  { path: 'reports', element: <ReportsPage /> },
                  { path: 'reports/new', element: <GenerateReportPage /> },
                  { path: 'reports/preview', element: <ReportPreviewPage /> },
                  { path: 'activity', element: <ActivityLogPage /> },
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
