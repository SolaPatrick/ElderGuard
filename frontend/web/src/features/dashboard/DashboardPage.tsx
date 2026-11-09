import { useCurrentUser } from '../../auth/authContext';
import { AdminDashboard } from './AdminDashboard';
import { CaregiverDashboard } from './CaregiverDashboard';

/** Admin/Head gets the facility-wide DASH-01; caregivers get their own DASH-02. */
export function DashboardPage() {
  const user = useCurrentUser();
  return user.role === 'admin' ? <AdminDashboard /> : <CaregiverDashboard />;
}
