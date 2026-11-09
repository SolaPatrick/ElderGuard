import type { SvgIconComponent } from '@mui/icons-material';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import Elderly from '@mui/icons-material/Elderly';
import MeetingRoomOutlined from '@mui/icons-material/MeetingRoomOutlined';
import LinkedCameraOutlined from '@mui/icons-material/LinkedCameraOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import type { Role } from '@elderguard/shared';

export interface NavItem {
  label: string;
  /** Label for employees when it differs (e.g. "My Residents"). */
  employeeLabel?: string;
  to: string;
  icon: SvgIconComponent;
  roles: Role[];
  /** Shows the active alert count badge. */
  alertBadge?: boolean;
}

const both: Role[] = ['admin', 'employee'];
const admin: Role[] = ['admin'];

/** Sidebar items in the order of the SH-01 (admin) and SH-02 (employee) layouts. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: GridViewOutlined, roles: both },
  { label: 'Live Monitoring', to: '/monitoring', icon: VideocamOutlined, roles: both },
  { label: 'Alerts', to: '/alerts', icon: NotificationsActiveOutlined, roles: both, alertBadge: true },
  { label: 'Incidents', to: '/incidents', icon: HistoryOutlined, roles: both },
  { label: 'Residents', employeeLabel: 'My Residents', to: '/residents', icon: Elderly, roles: both },
  { label: 'Rooms & Areas', to: '/rooms', icon: MeetingRoomOutlined, roles: admin },
  { label: 'Cameras & Devices', to: '/cameras', icon: LinkedCameraOutlined, roles: admin },
  { label: 'Users & Access', to: '/users', icon: ManageAccountsOutlined, roles: admin },
  { label: 'Reports', to: '/reports', icon: AssessmentOutlined, roles: admin },
  { label: 'Activity Log', to: '/activity', icon: ReceiptLongOutlined, roles: admin },
  { label: 'Notifications', to: '/notifications', icon: NotificationsOutlined, roles: ['employee'] },
  { label: 'Settings', to: '/settings', icon: SettingsOutlined, roles: admin },
];
