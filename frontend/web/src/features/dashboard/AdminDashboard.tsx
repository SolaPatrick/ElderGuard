import { useState, type ReactNode } from 'react';
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
  Typography,
} from '@mui/material';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import VideocamOutlined from '@mui/icons-material/VideocamOutlined';
import Elderly from '@mui/icons-material/Elderly';
import { Link as RouterLink } from 'react-router';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  formatLongDate,
  formatShortDuration,
  formatTime,
  incidentPersonName,
  initials,
  type Camera,
  type DashboardSummary,
  type Incident,
} from '@elderguard/shared';
import {
  useActiveIncidents,
  useActivity,
  useCameras,
  useDashboardSummary,
  useIncidents,
} from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { ActiveAlertsCard, SectionCard } from './DashboardCards';
import { useTokens } from '../../theme/useTokens';

function KpiCard({
  icon,
  label,
  value,
  detail,
  urgent = false,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: string;
  urgent?: boolean;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        ...(urgent && {
          bgcolor: 'eg.comp.alertWashNew',
          borderColor: 'eg.comp.alertBorderNew',
          borderWidth: 2,
        }),
      }}
    >
      <CardContent sx={{ p: 5 }}>
        <Stack
          direction="row"
          spacing={2}
          sx={{ alignItems: 'flex-start', color: urgent ? 'eg.sys.critical' : 'text.secondary' }}
        >
          <Box sx={{ mt: 0.5, display: 'flex' }}>{icon}</Box>
          <Typography
            variant="body2"
            sx={{
              color: urgent ? 'eg.sys.onCriticalContainer' : 'text.primary',
              fontWeight: urgent ? 600 : 400,
            }}
          >
            {label}
          </Typography>
        </Stack>
        <Typography
          variant="h3"
          component="p"
          sx={{ mt: 3, color: urgent ? 'eg.sys.critical' : 'text.primary' }}
        >
          {value}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {detail}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCards({ data }: { data: DashboardSummary }) {
  const { activeAlerts, incidentsToday, cameras } = data;
  const cameraDetail = [
    cameras.offline > 0 && `${cameras.offline} offline`,
    cameras.paused > 0 && `${cameras.paused} paused`,
    cameras.error > 0 && `${cameras.error} error`,
  ]
    .filter(Boolean)
    .join(' · ');
  const cards = [
    <KpiCard
      key="alerts"
      urgent={activeAlerts.total > 0}
      icon={<NotificationsActiveOutlined fontSize="small" />}
      label="Active alerts"
      value={activeAlerts.total}
      detail={`${activeAlerts.new} new · ${activeAlerts.acknowledged} acknowledged`}
    />,
    <KpiCard
      key="today"
      icon={<InfoOutlined fontSize="small" />}
      label="Incidents today"
      value={incidentsToday.total}
      detail={`${incidentsToday.confirmed} confirmed · ${incidentsToday.falseAlarms} false alarm`}
    />,
    <KpiCard
      key="cams"
      icon={<VideocamOutlined fontSize="small" />}
      label="Cameras online"
      value={`${cameras.online} / ${cameras.total}`}
      {...(cameraDetail ? { detail: cameraDetail } : {})}
    />,
    <KpiCard
      key="res"
      icon={<Elderly fontSize="small" />}
      label="Residents monitored"
      value={data.residentsMonitored}
    />,
    <KpiCard
      key="far"
      icon={<InfoOutlined fontSize="small" />}
      label="False alarm rate (7 days)"
      value={data.falseAlarmRate7d === null ? '—' : `${Math.round(data.falseAlarmRate7d * 100)}%`}
    />,
    <KpiCard
      key="ack"
      icon={<InfoOutlined fontSize="small" />}
      label="Avg time to acknowledge"
      value={formatShortDuration(data.avgAckSeconds)}
    />,
  ];
  return (
    <Grid container spacing={4} sx={{ mb: 6 }}>
      {cards.map((card) => (
        <Grid key={card.key} size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          {card}
        </Grid>
      ))}
    </Grid>
  );
}

function CameraStatusCard({ cameras }: { cameras: Camera[] }) {
  const group = (status: Camera['status']) => cameras.filter((c) => c.status === status);
  const describe = (list: Camera[]) =>
    list.length === 0
      ? '0'
      : `${list.length} · ${list.map((c) => `${c.code} ${c.roomName ?? ''}`.trim()).join(', ')}`;
  const cells: [string, string][] = [
    ['Online', String(group('online').length)],
    ['Offline', describe(group('offline'))],
    ['Detection paused', describe(group('paused'))],
    ['Error', describe(group('error'))],
  ];
  return (
    <SectionCard title="Camera status">
      <Grid container spacing={4}>
        {cells.map(([label, value]) => (
          <Grid key={label} size={6}>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="body2">{value}</Typography>
          </Grid>
        ))}
      </Grid>
    </SectionCard>
  );
}

function FallsChart({ data }: { data: DashboardSummary['fallsThisWeek'] }) {
  const colors = useTokens().chart;
  const rows = data.map((d) => ({
    day: new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
    falls: d.count,
  }));
  return (
    <SectionCard title="Falls this week">
      <Box
        sx={{ height: 220 }}
        role="img"
        aria-label={`Falls per day: ${rows.map((r) => `${r.day} ${r.falls}`).join(', ')}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={colors.grid} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.axis, fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.axis, fontSize: 12 }}
            />
            <Tooltip cursor={{ fill: 'transparent' }} />
            <Bar dataKey="falls" name="Falls" fill={colors['1']} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </SectionCard>
  );
}

function RecentIncidentsCard({ incidents }: { incidents: Incident[] }) {
  return (
    <SectionCard
      title="Recent incidents"
      action={
        <Link component={RouterLink} to="/incidents">
          View all
        </Link>
      }
    >
      {incidents.length === 0 ? (
        <Typography color="text.secondary">No incidents yet.</Typography>
      ) : (
        <Stack divider={<Divider />} spacing={3}>
          {incidents.map((i) => (
            <Stack key={i.code} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={`/incidents/${i.code}`}
                  color="inherit"
                  underline="hover"
                  variant="subtitle2"
                >
                  {i.code} · {incidentPersonName(i)}
                </Link>
                <Typography variant="caption" color="text.secondary" component="div">
                  {i.room.name} · {formatTime(i.detectedAt)}
                </Typography>
              </Box>
              <StatusChip kind="incident" status={i.status} />
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

function ActivityCard() {
  const activity = useActivity(3);
  return (
    <SectionCard
      title="Recent staff activity"
      action={
        <Link component={RouterLink} to="/activity">
          Activity log
        </Link>
      }
    >
      {activity.isPending ? (
        <SkeletonRows rows={3} />
      ) : activity.isError ? (
        <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
      ) : (
        <Stack divider={<Divider />} spacing={3}>
          {activity.data.map((a) => (
            <Stack key={a.id} direction="row" spacing={3} sx={{ alignItems: 'center' }}>
              <Avatar
                sx={{
                  bgcolor: 'eg.sys.primaryContainer',
                  color: 'eg.sys.onPrimaryContainer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {initials(a.user.fullName)}
              </Avatar>
              <Box>
                <Typography variant="subtitle2">{a.summary}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatTime(a.createdAt)}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

/** DASH-01: facility-wide dashboard for the Admin/Head. */
export function AdminDashboard() {
  const summary = useDashboardSummary();
  const active = useActiveIncidents();
  const cameras = useCameras();
  const incidents = useIncidents();
  const [today] = useState(() => new Date());

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${formatLongDate(today)} · ${summary.data?.facilityName ?? 'Demo Home for the Aged'}`}
        actions={
          <Button variant="outlined" component={RouterLink} to="/monitoring">
            Open Live Monitoring
          </Button>
        }
      />

      {summary.isPending ? (
        <Box sx={{ mb: 6 }}>
          <SkeletonRows rows={2} />
        </Box>
      ) : summary.isError ? (
        <Box sx={{ mb: 6 }}>
          <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
        </Box>
      ) : (
        <SummaryCards data={summary.data} />
      )}

      <Grid container spacing={4} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          {active.isPending ? <SkeletonRows /> : <ActiveAlertsCard incidents={active.data ?? []} />}
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          {cameras.isError ? (
            <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />
          ) : cameras.isPending ? (
            <SkeletonRows />
          ) : (
            <CameraStatusCard cameras={cameras.data} />
          )}
        </Grid>
      </Grid>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          {summary.data && <FallsChart data={summary.data.fallsThisWeek} />}
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          {incidents.isError ? (
            <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />
          ) : incidents.isPending ? (
            <SkeletonRows />
          ) : (
            <RecentIncidentsCard
              incidents={incidents.data
                .filter((i) => i.status !== 'new' && i.status !== 'acknowledged')
                .slice(0, 3)}
            />
          )}
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ActivityCard />
        </Grid>
      </Grid>
    </>
  );
}
