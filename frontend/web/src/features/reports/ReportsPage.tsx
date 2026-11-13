import { useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  formatDate,
  formatShortDuration,
  INCIDENT_STATUS_LABEL,
  isValidRange,
  lastDays,
  reportStats,
  type Count,
  type ReportRange,
  type ReportStats,
} from '@elderguard/shared';
import { useIncidentsBetween } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { SectionCard } from '../dashboard/DashboardCards';
import { useTokens } from '../../theme/useTokens';

const PRESETS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TOP = 8;

const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

function Kpi({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="h3" component="p" sx={{ mt: 3 }}>
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

function Kpis({ s }: { s: ReportStats }) {
  const cards = [
    { label: 'Total alerts', value: s.totalAlerts, detail: s.open > 0 ? `${s.open} not classified yet` : '' },
    { label: 'Confirmed falls', value: s.confirmedFalls },
    { label: 'False alarms', value: s.falseAlarms },
    { label: 'False alarm rate', value: percent(s.falseAlarmRate), detail: 'Of alerts staff classified' },
    { label: 'Avg time to acknowledge', value: formatShortDuration(s.avgAckSeconds) },
    { label: 'Avg time to resolve', value: formatShortDuration(s.avgResolveSeconds) },
    { label: 'SOS alerts', value: s.sosCount },
  ];
  return (
    <Grid
      container
      spacing={4}
      sx={{ mb: 4 }}
      component="ul"
      aria-label="Key figures"
      style={{ listStyle: 'none', padding: 0 }}
    >
      {cards.map((c) => (
        <Grid
          key={c.label}
          size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
          component="li"
          aria-label={`${c.label}: ${c.value}`}
        >
          <Kpi label={c.label} value={c.value} {...(c.detail ? { detail: c.detail } : {})} />
        </Grid>
      ))}
    </Grid>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary">{children}</Typography>;
}

function FallsOverTime({ data }: { data: ReportStats['fallsByDay'] }) {
  const colors = useTokens().chart;
  const rows = data.map((d) => ({
    day: formatDate(new Date(`${d.date}T00:00:00`)).replace(/ \d{4}$/, ''),
    falls: d.count,
  }));
  const total = data.reduce((a, d) => a + d.count, 0);
  return (
    <SectionCard title="Falls over time">
      {total === 0 ? (
        <Empty>No falls in this period.</Empty>
      ) : (
        <Box
          sx={{ height: 240 }}
          role="img"
          aria-label={`Falls per day: ${rows
            .filter((r) => r.falls > 0)
            .map((r) => `${r.day} ${r.falls}`)
            .join(', ')}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.grid} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tick={{ fill: colors.axis, fontSize: 12 }}
                minTickGap={16}
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
      )}
    </SectionCard>
  );
}

/** A ranked list with a bar behind each count. Reads as a list for screen readers. */
function RankedBars({
  title,
  rows,
  empty,
  note,
  color,
}: {
  title: string;
  rows: Count[];
  empty: string;
  note?: string;
  color: string;
}) {
  const top = rows.slice(0, TOP);
  const max = Math.max(1, ...top.map((r) => r.count));
  return (
    <SectionCard title={title}>
      {top.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <Stack component="ul" aria-label={title} spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {top.map((r) => (
            <Box component="li" key={r.label} aria-label={`${r.label}: ${r.count}`}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                  {r.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, ml: 2 }}>
                  {r.count}
                </Typography>
              </Stack>
              <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover' }}>
                <Box
                  sx={{ height: '100%', width: `${(r.count / max) * 100}%`, borderRadius: 4, bgcolor: color }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      )}
      {(note || rows.length > TOP) && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>
          {[rows.length > TOP && `Showing the top ${TOP} of ${rows.length}.`, note].filter(Boolean).join(' ')}
        </Typography>
      )}
    </SectionCard>
  );
}

function Heatmap({ grid }: { grid: number[][] }) {
  const t = useTokens();
  const max = Math.max(0, ...grid.flat());
  const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
  return (
    <SectionCard title="Falls by day and hour">
      {max === 0 ? (
        <Empty>No falls in this period.</Empty>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box
            component="table"
            aria-label="Falls by day of the week and hour"
            sx={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 11, minWidth: 560 }}
          >
            <thead>
              <tr>
                <th />
                {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                  <Box
                    component="th"
                    key={h}
                    scope="colgroup"
                    colSpan={3}
                    sx={{ fontWeight: 400, color: 'text.secondary', textAlign: 'left', whiteSpace: 'nowrap' }}
                  >
                    {hourLabel(h)}
                  </Box>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, d) => (
                <tr key={WEEKDAYS[d]}>
                  <Box
                    component="th"
                    scope="row"
                    sx={{ fontWeight: 400, color: 'text.secondary', pr: 1, textAlign: 'left' }}
                  >
                    {WEEKDAYS[d]}
                  </Box>
                  {row.map((count, h) => {
                    const strength = count / max;
                    return (
                      <Box
                        component="td"
                        key={h}
                        title={`${WEEKDAYS[d]} ${hourLabel(h)}: ${count}`}
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 0.5,
                          textAlign: 'center',
                          bgcolor:
                            count === 0
                              ? 'action.hover'
                              : `${t.chart['1']}${Math.round((0.25 + 0.75 * strength) * 255)
                                  .toString(16)
                                  .padStart(2, '0')}`,
                          color: strength >= 0.6 ? t.sys.onPrimary : 'text.primary',
                        }}
                      >
                        {count > 0 ? (
                          count
                        ) : (
                          <Box component="span" sx={visuallyHidden}>
                            0
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}
    </SectionCard>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

function Analytics({ range }: { range: ReportRange }) {
  const incidents = useIncidentsBetween(range);
  const colors = useTokens().chart;
  if (incidents.isPending) return <SkeletonRows rows={4} />;
  if (incidents.isError)
    return <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />;
  const s = reportStats(incidents.data, range);
  return (
    <>
      <Kpis s={s} />
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <FallsOverTime data={s.fallsByDay} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <RankedBars
            title="Alert outcomes"
            rows={s.outcomes
              .filter((o) => o.count > 0)
              .map((o) => ({ label: INCIDENT_STATUS_LABEL[o.status], count: o.count }))}
            empty="No alerts in this period."
            color={colors['2']}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <RankedBars
            title="Falls by location"
            rows={s.fallsByLocation}
            empty="No falls in this period."
            color={colors['1']}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <RankedBars
            title="Falls by resident"
            rows={s.fallsByResident}
            empty="No falls with a known resident in this period."
            note="Only falls where the resident is known."
            color={colors['3']}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <RankedBars
            title="False alarm reasons"
            rows={s.falseAlarmReasons}
            empty="No false alarms in this period."
            color={colors['4']}
          />
        </Grid>
        <Grid size={12}>
          <Heatmap grid={s.fallsByWeekdayHour} />
        </Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 4 }}>
        Falls are fall alerts that were not false alarms, including ones not classified yet. Test alarms are
        left out. Camera uptime is not shown because the server does not keep a history of camera status yet.
      </Typography>
    </>
  );
}

/** RPT-01: analytics for the Admin/Head over a date range. */
export function ReportsPage() {
  const [preset, setPreset] = useState<number | 'custom'>(7);
  const [range, setRange] = useState<ReportRange>(() => lastDays(7));
  const valid = isValidRange(range);

  const choose = (value: number | 'custom' | null) => {
    if (value === null) return;
    setPreset(value);
    if (value !== 'custom') setRange(lastDays(value));
  };
  const setDate = (key: keyof ReportRange) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPreset('custom');
    setRange((r) => ({ ...r, [key]: e.target.value }));
  };

  return (
    <>
      <PageHeader title="Reports & analytics" subtitle="Alerts and falls over the dates you choose" />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 6, alignItems: { md: 'center' } }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={preset}
          onChange={(_, v: number | 'custom' | null) => choose(v)}
          aria-label="Date range"
        >
          {PRESETS.map((p) => (
            <ToggleButton key={p.days} value={p.days}>
              {p.label}
            </ToggleButton>
          ))}
          <ToggleButton value="custom">Custom</ToggleButton>
        </ToggleButtonGroup>
        <Stack direction="row" spacing={3}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={range.from}
            onChange={setDate('from')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={range.to}
            onChange={setDate('to')}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </Stack>
      {valid ? (
        <Analytics range={range} />
      ) : (
        <Alert severity="warning">Choose a start date on or before the end date.</Alert>
      )}
    </>
  );
}
