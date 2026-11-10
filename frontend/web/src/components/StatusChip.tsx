import { Box } from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlined from '@mui/icons-material/ErrorOutlined';
import HighlightOffOutlined from '@mui/icons-material/HighlightOffOutlined';
import ScheduleOutlined from '@mui/icons-material/ScheduleOutlined';
import FiberNewOutlined from '@mui/icons-material/FiberNewOutlined';
import GppMaybeOutlined from '@mui/icons-material/GppMaybeOutlined';
import ShieldOutlined from '@mui/icons-material/ShieldOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  CAMERA_STATUS_LABEL,
  FALL_RISK_LABEL,
  INCIDENT_STATUS_LABEL,
  type FallRisk,
  type CameraStatus,
  type IncidentStatus,
} from '@elderguard/shared';

type Props =
  | { kind: 'incident'; status: IncidentStatus }
  | { kind: 'camera'; status: CameraStatus }
  | { kind: 'system'; status: 'operational' | 'degraded' | 'down'; label: string }
  | { kind: 'risk'; risk: FallRisk }
  | { kind: 'account'; active: boolean };

const incidentToken: Record<IncidentStatus, string> = {
  new: 'incidentNew',
  acknowledged: 'incidentAcknowledged',
  confirmed: 'incidentConfirmed',
  false_alarm: 'incidentFalseAlarm',
  resolved: 'incidentResolved',
};
const incidentIcon: Record<IncidentStatus, SvgIconComponent> = {
  new: FiberNewOutlined,
  acknowledged: ScheduleOutlined,
  confirmed: ErrorOutlined,
  false_alarm: HighlightOffOutlined,
  resolved: CheckCircleOutlined,
};
const cameraToken: Record<CameraStatus, string> = {
  online: 'cameraOnline',
  offline: 'cameraOffline',
  error: 'cameraError',
  paused: 'cameraPaused',
  connecting: 'cameraConnecting',
};

/**
 * Status pill using the design system's status tokens. Status is always shown
 * with text + icon, never color alone (accessibility rule from the design).
 */
export function StatusChip(props: Props) {
  let token: string;
  let label: string;
  let Icon: SvgIconComponent = CheckCircleOutlined;
  if (props.kind === 'incident') {
    token = incidentToken[props.status];
    label = INCIDENT_STATUS_LABEL[props.status];
    Icon = incidentIcon[props.status];
  } else if (props.kind === 'camera') {
    token = cameraToken[props.status];
    label = CAMERA_STATUS_LABEL[props.status];
    Icon = props.status === 'online' ? CheckCircleOutlined : ErrorOutlined;
  } else if (props.kind === 'risk') {
    // DS rule: High risk is the one allowed red use outside alerts (outlined critical chip).
    token = `risk${props.risk[0]!.toUpperCase()}${props.risk.slice(1)}`;
    label = FALL_RISK_LABEL[props.risk];
    Icon = props.risk === 'high' ? GppMaybeOutlined : ShieldOutlined;
  } else if (props.kind === 'account') {
    // Same colors as an online / offline camera: green for active, neutral for deactivated.
    token = props.active ? 'cameraOnline' : 'cameraOffline';
    label = props.active ? 'Active' : 'Deactivated';
    Icon = props.active ? PersonOutlined : BlockOutlined;
  } else {
    token = `system${props.status[0]!.toUpperCase()}${props.status.slice(1)}`;
    label = props.label;
    Icon = props.status === 'operational' ? CheckCircleOutlined : ErrorOutlined;
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2.5,
        py: 0.5,
        borderRadius: 2,
        border: 1,
        borderColor: `eg.status.${token}Border`,
        bgcolor: `eg.status.${token}Bg`,
        color: `eg.status.${token}Fg`,
        typography: 'caption',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon sx={{ fontSize: 14 }} aria-hidden />
      {label}
    </Box>
  );
}
