import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Sos from '@mui/icons-material/Sos';
import LabelOutlined from '@mui/icons-material/LabelOutlined';
import { Link as RouterLink } from 'react-router';
import {
  describeAreas,
  formatDate,
  formatShortDuration,
  formatTime,
  incidentPersonName,
  initials,
  isActiveStatus,
  secondsBetween,
  type Camera,
  type Incident,
  type Resident,
} from '@elderguard/shared';
import { useActiveIncidents, useCameras, useIncidents, useResidents } from '../../api/queries';
import { useCurrentUser } from '../../auth/authContext';
import { CameraTile } from '../../components/CameraTile';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { SosDialog } from '../sos/SosDialog';
import { ActiveAlertsCard, SectionCard } from './DashboardCards';

function greeting(date: Date) {
  const h = date.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function ResidentsCard({ residents }: { residents: Resident[] }) {
  return (
    <SectionCard
      title="My residents"
      action={
        <Link component={RouterLink} to="/residents">
          View all
        </Link>
      }
    >
      {residents.length === 0 ? (
        <Typography color="text.secondary">No residents are assigned to you yet.</Typography>
      ) : (
        <Stack divider={<Divider />} spacing={3}>
          {residents.map((r) => (
            <Stack key={r.id} direction="row" spacing={3} sx={{ alignItems: 'center' }}>
              <Avatar
                sx={{
                  bgcolor: 'eg.sys.primaryContainer',
                  color: 'eg.sys.onPrimaryContainer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {initials(r.fullName)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2">{r.fullName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[r.age, r.room?.name].filter((x) => x !== null && x !== undefined).join(' · ')}
                </Typography>
              </Box>
              <StatusChip kind="risk" risk={r.fallRisk} />
              {r.hasActiveAlert && (
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
                    borderColor: 'eg.sys.neutralStatus',
                    bgcolor: 'eg.sys.neutralContainer',
                    color: 'eg.sys.onNeutralContainer',
                    typography: 'caption',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <LabelOutlined sx={{ fontSize: 14 }} aria-hidden />
                  Alert active
                </Box>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

function AreasCard({ cameras, alerts }: { cameras: Camera[]; alerts: Incident[] }) {
  return (
    <SectionCard
      title="My monitoring areas"
      action={
        <Link component={RouterLink} to="/monitoring">
          Open Live Monitoring
        </Link>
      }
    >
      {cameras.length === 0 ? (
        <Typography color="text.secondary">No cameras in your assigned areas.</Typography>
      ) : (
        <Grid container spacing={2}>
          {cameras.map((c) => (
            <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CameraTile
                camera={c}
                to={`/monitoring/${c.code}`}
                alert={alerts.find((a) => a.room.id === c.roomId) ?? null}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </SectionCard>
  );
}

function HandledIncidentsCard({ incidents }: { incidents: Incident[] }) {
  return (
    <Card>
      <CardContent sx={{ p: 5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', mb: 4 }}>
          <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
            Incidents I handled recently
          </Typography>
          <Link component={RouterLink} to="/incidents">
            View all
          </Link>
        </Stack>
        {incidents.length === 0 ? (
          <Typography color="text.secondary">You have not handled any incidents yet.</Typography>
        ) : (
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'eg.sys.surfaceContainerLow' }}>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Resident</TableCell>
                  <TableCell>Detected at</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Response time</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {incidents.map((i) => (
                  <TableRow key={i.code} hover>
                    <TableCell>
                      <Link component={RouterLink} to={`/incidents/${i.code}`} color="inherit">
                        {i.code}
                      </Link>
                    </TableCell>
                    <TableCell>{i.type === 'fall' ? 'Fall' : 'SOS'}</TableCell>
                    <TableCell>{incidentPersonName(i)}</TableCell>
                    <TableCell>
                      {formatTime(i.detectedAt)} · {formatDate(i.detectedAt)}
                    </TableCell>
                    <TableCell>
                      <StatusChip kind="incident" status={i.status} />
                    </TableCell>
                    <TableCell>
                      {i.acknowledgedAt
                        ? formatShortDuration(secondsBetween(i.detectedAt, Date.parse(i.acknowledgedAt)))
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** DASH-02: a caregiver's own alerts, residents and cameras. */
export function CaregiverDashboard() {
  const user = useCurrentUser();
  const active = useActiveIncidents();
  const residents = useResidents();
  const cameras = useCameras();
  const incidents = useIncidents();
  const [now] = useState(() => new Date());
  const [sosOpen, setSosOpen] = useState(false);
  const firstName = user.fullName.split(' ').filter((w) => !w.endsWith('.'))[0] ?? user.fullName;
  const activeIncidents = active.data ?? [];
  const handled = (incidents.data ?? [])
    .filter((i) => !isActiveStatus(i.status))
    .filter((i) => i.acknowledgedBy?.id === user.id || i.resolvedBy?.id === user.id)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${firstName}`}
        subtitle={describeAreas(user.areas)}
        actions={
          <Button
            variant="contained"
            size="large"
            startIcon={<Sos />}
            onClick={() => setSosOpen(true)}
            aria-haspopup="dialog"
            sx={{
              bgcolor: 'eg.comp.sosFill',
              color: 'eg.comp.sosLabel',
              minHeight: 56,
              '&:hover': { bgcolor: 'eg.comp.sosFill' },
            }}
          >
            Send SOS
          </Button>
        }
      />
      <SosDialog open={sosOpen} onClose={() => setSosOpen(false)} />

      <Box sx={{ mb: 4 }}>
        {active.isPending ? (
          <SkeletonRows rows={2} />
        ) : active.isError && !active.data ? (
          <ErrorState error={active.error} onRetry={() => void active.refetch()} />
        ) : (
          <ActiveAlertsCard
            incidents={activeIncidents}
            title={`My active alerts (${activeIncidents.length})`}
            showDetailsLink
          />
        )}
      </Box>

      <Grid container spacing={4} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          {residents.isPending ? (
            <SkeletonRows rows={4} />
          ) : residents.isError ? (
            <ErrorState error={residents.error} onRetry={() => void residents.refetch()} />
          ) : (
            <ResidentsCard residents={residents.data} />
          )}
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          {cameras.isPending ? (
            <SkeletonRows rows={2} />
          ) : cameras.isError ? (
            <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />
          ) : (
            <AreasCard cameras={cameras.data} alerts={activeIncidents} />
          )}
        </Grid>
      </Grid>

      {incidents.isPending ? (
        <SkeletonRows rows={3} />
      ) : incidents.isError ? (
        <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />
      ) : (
        <HandledIncidentsCard incidents={handled} />
      )}
    </>
  );
}
