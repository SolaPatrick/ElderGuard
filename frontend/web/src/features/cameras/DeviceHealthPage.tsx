import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  Chip,
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
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { formatTime, type Camera } from '@elderguard/shared';
import { api } from '../../api/endpoints';
import { useCameras } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { errorMessage } from '../../components/errorMessage';
import { lastSeenLabel } from './cameraLabels';

const CHECK_MS = 10_000;

/** Asks the server who is signed in, and times the answer. A real round trip, measured here. */
function useServerCheck() {
  return useQuery({
    queryKey: ['server-check'],
    queryFn: async () => {
      const started = performance.now();
      await api.me();
      return { ms: Math.round(performance.now() - started), at: new Date().toISOString() };
    },
    refetchInterval: CHECK_MS,
    retry: false,
  });
}

/** "12 FPS" from "1080p · 12 FPS" or "12 FPS". */
function fpsOf(c: Camera): number | null {
  const m = c.resolutionFps?.match(/([\d.]+)\s*FPS/i);
  return m ? Number(m[1]) : null;
}

function Panel({ title, status, children }: { title: string; status: ReactNode; children: ReactNode }) {
  return (
    <Card sx={{ height: '100%' }} component="section" aria-label={title}>
      <CardContent sx={{ p: 5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2 }}>
          <Typography variant="h6" component="h2">
            {title}
          </Typography>
          {status}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

const NOT_REPORTED = <Chip size="small" label="Not reported" variant="outlined" />;

/** CAM-06: is everything that monitoring depends on working right now? Admin/Head only. */
export function DeviceHealthPage() {
  const cameras = useCameras();
  const server = useServerCheck();
  const all = cameras.data ?? [];
  const analysing = all.filter((c) => c.status === 'online');
  const fps = analysing.map(fpsOf).filter((x): x is number => x !== null);
  const problems = all.filter((c) => c.status === 'offline' || c.status === 'error');

  return (
    <>
      <PageHeader
        title="Device health"
        subtitle="Checked every 10 seconds while this page is open"
        breadcrumb={
          <Link component={RouterLink} to="/cameras" color="inherit">
            Cameras & Devices
          </Link>
        }
      />

      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Panel
            title="Server"
            status={
              server.isPending ? (
                <Chip size="small" label="Checking…" />
              ) : server.isError ? (
                <Chip size="small" color="error" label="Not responding" />
              ) : (
                <Chip size="small" color="success" label="Responding" />
              )
            }
          >
            {server.isError ? (
              <Typography variant="body2">{errorMessage(server.error)}</Typography>
            ) : server.data ? (
              <Typography variant="body2">
                Answered in {server.data.ms} ms · last checked {formatTime(server.data.at)}
              </Typography>
            ) : null}
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Panel
            title="Fall detection"
            status={
              cameras.isPending ? null : analysing.length > 0 ? (
                <Chip size="small" color="success" label="Running" />
              ) : (
                <Chip size="small" color="warning" label="No camera running" />
              )
            }
          >
            <Typography variant="body2">
              {analysing.length} of {all.length} cameras analysed
              {fps.length > 0 &&
                ` · ${Math.round(fps.reduce((a, b) => a + b, 0) * 10) / 10} frames per second in total`}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
              CPU and GPU load and detection delay are not reported by the server yet.
            </Typography>
          </Panel>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <Panel title="Notifications and storage" status={NOT_REPORTED}>
            <Typography variant="body2">
              The server does not report the notification service or free disk space yet.
            </Typography>
          </Panel>
        </Grid>
      </Grid>

      <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
        Cameras {problems.length > 0 && `· ${problems.length} need attention`}
      </Typography>
      {cameras.isPending ? (
        <SkeletonRows rows={4} />
      ) : cameras.isError ? (
        <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />
      ) : (
        <TableContainer component={Card}>
          <Table aria-label="Camera health">
            <TableHead>
              <TableRow>
                <TableCell>Camera</TableCell>
                <TableCell>Room</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Frames per second</TableCell>
                <TableCell>Last seen</TableCell>
                <TableCell>Problem</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {all
                .toSorted(
                  (a, b) =>
                    Number(b.status === 'error' || b.status === 'offline') -
                    Number(a.status === 'error' || a.status === 'offline'),
                )
                .map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link component={RouterLink} to={`/cameras/${c.id}`} sx={{ fontWeight: 600 }}>
                        {c.code}
                      </Link>
                    </TableCell>
                    <TableCell>{c.roomName ?? '—'}</TableCell>
                    <TableCell>
                      <StatusChip kind="camera" status={c.status} />
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {c.status === 'online' ? (fpsOf(c) ?? '—') : '—'}
                    </TableCell>
                    <TableCell>{lastSeenLabel(c)}</TableCell>
                    <TableCell>{c.statusDetail ?? '—'}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
