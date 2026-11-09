import {
  Card,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router';
import {
  formatDate,
  formatElapsed,
  formatTime,
  incidentPersonName,
  secondsBetween,
  type Incident,
} from '@elderguard/shared';
import { StatusChip } from '../../components/StatusChip';
import { useNow } from '../../hooks/useNow';

export function IncidentTable({
  incidents,
  basePath,
  showElapsed = false,
  emptyText,
}: {
  incidents: Incident[];
  basePath: '/alerts' | '/incidents';
  showElapsed?: boolean;
  emptyText: string;
}) {
  const now = useNow();
  if (incidents.length === 0) {
    return (
      <Card sx={{ p: 8, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyText}</Typography>
      </Card>
    );
  }
  return (
    <TableContainer component={Card}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Incident</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Resident / sender</TableCell>
            <TableCell>Room</TableCell>
            <TableCell>{showElapsed ? 'Elapsed' : 'Detected'}</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {incidents.map((i) => (
            <TableRow key={i.code} hover>
              <TableCell>
                <Link component={RouterLink} to={`${basePath}/${i.code}`} sx={{ fontWeight: 600 }}>
                  {i.code}
                </Link>
              </TableCell>
              <TableCell>{i.type === 'fall' ? 'Fall' : 'SOS'}</TableCell>
              <TableCell>{incidentPersonName(i)}</TableCell>
              <TableCell>{i.room.name}</TableCell>
              <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {showElapsed
                  ? formatElapsed(secondsBetween(i.detectedAt, now))
                  : `${formatTime(i.detectedAt)} · ${formatDate(i.detectedAt)}`}
              </TableCell>
              <TableCell>
                <StatusChip kind="incident" status={i.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
