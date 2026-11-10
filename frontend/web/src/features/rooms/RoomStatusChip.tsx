import { Typography } from '@mui/material';
import { StatusChip } from '../../components/StatusChip';
import { ROOM_STATUS_LABEL, type RoomStatus } from './roomStats';

export function RoomStatusChip({ status }: { status: RoomStatus }) {
  if (status === 'no_camera') {
    return (
      <Typography variant="body2" color="text.secondary">
        {ROOM_STATUS_LABEL.no_camera}
      </Typography>
    );
  }
  return (
    <StatusChip
      kind="system"
      status={status === 'active' ? 'operational' : 'degraded'}
      label={ROOM_STATUS_LABEL[status]}
    />
  );
}
