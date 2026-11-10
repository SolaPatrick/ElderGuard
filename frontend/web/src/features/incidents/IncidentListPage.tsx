import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  InputAdornment,
  Link,
  MenuItem,
  Pagination,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined';
import FilterListOutlined from '@mui/icons-material/FilterListOutlined';
import SearchOffOutlined from '@mui/icons-material/SearchOffOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { Link as RouterLink, useSearchParams } from 'react-router';
import {
  INCIDENT_STATUS_LABEL,
  formatDate,
  formatShortDuration,
  formatTime,
  incidentPersonName,
  incidentStatusSchema,
  type Incident,
  type IncidentStatus,
} from '@elderguard/shared';
import { useIncidentHistory } from '../../api/queries';
import { HISTORY_LIMIT } from '../../api/config';
import { useCurrentUser } from '../../auth/authContext';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { IncidentFilterDrawer } from './IncidentFilterDrawer';
import {
  CLASSIFICATION_LABEL,
  DATE_LABEL,
  NO_FILTERS,
  TYPE_LABEL,
  drawerCount,
  filterIncidents,
  handledBy,
  incidentsCsv,
  pickerOptions,
  readFilters,
  responseSeconds,
  writeFilters,
  type DatePreset,
  type IncidentFilters,
} from './incidentFilters';

export const PAGE_SIZE = 25;

function HistoryTable({ incidents }: { incidents: Incident[] }) {
  return (
    <TableContainer component={Card}>
      <Table aria-label="Incidents">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Resident</TableCell>
            <TableCell>Location</TableCell>
            <TableCell aria-sort="descending">Detected at ▼</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Handled by</TableCell>
            <TableCell>Response time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {incidents.map((i) => (
            <TableRow key={i.code} hover>
              <TableCell>
                <Link component={RouterLink} to={`/incidents/${i.code}`} sx={{ fontWeight: 600 }}>
                  {i.code}
                </Link>
              </TableCell>
              <TableCell>{TYPE_LABEL[i.type]}</TableCell>
              <TableCell>{incidentPersonName(i)}</TableCell>
              <TableCell>{i.room.name}</TableCell>
              <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {formatTime(i.detectedAt)} · {formatDate(i.detectedAt)}
              </TableCell>
              <TableCell>
                <StatusChip kind="incident" status={i.status} />
              </TableCell>
              <TableCell>{handledBy(i)?.fullName ?? '—'}</TableCell>
              <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatShortDuration(responseSeconds(i))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function downloadCsv(incidents: Incident[]) {
  const blob = new Blob([incidentsCsv(incidents)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** The removable chips under the toolbar, one per drawer filter. */
function activeChips(
  f: IncidentFilters,
  names: ReturnType<typeof pickerOptions>,
): { key: string; label: string; clear: Partial<IncidentFilters> }[] {
  const name = (items: { id: string; name: string }[], id: string) =>
    items.find((x) => x.id === id)?.name ?? id;
  const range = [
    f.from ? formatDate(`${f.from}T12:00:00`) : '…',
    f.to ? formatDate(`${f.to}T12:00:00`) : '…',
  ];
  return [
    ...(f.residentId
      ? [{ key: 'resident', label: name(names.residents, f.residentId), clear: { residentId: '' } }]
      : []),
    ...(f.roomId ? [{ key: 'room', label: name(names.rooms, f.roomId), clear: { roomId: '' } }] : []),
    ...(f.date === 'custom'
      ? [{ key: 'date', label: range.join(' – '), clear: { date: NO_FILTERS.date, from: '', to: '' } }]
      : []),
    ...f.statuses.map((s) => ({
      key: `status-${s}`,
      label: `Status: ${INCIDENT_STATUS_LABEL[s]}`,
      clear: { statuses: f.statuses.filter((x) => x !== s) },
    })),
    ...f.types.map((t) => ({
      key: `type-${t}`,
      label: `Type: ${TYPE_LABEL[t]}`,
      clear: { types: f.types.filter((x) => x !== t) },
    })),
    ...(f.handledById
      ? [
          {
            key: 'handled',
            label: `Handled by ${name(names.staff, f.handledById)}`,
            clear: { handledById: '' },
          },
        ]
      : []),
    ...(f.classification
      ? [
          {
            key: 'class',
            label: CLASSIFICATION_LABEL[f.classification],
            clear: { classification: '' as const },
          },
        ]
      : []),
  ];
}

/** INC-01 Incident history and INC-02 Advanced filters (Admin/Head and caregivers). */
export function IncidentListPage() {
  const user = useCurrentUser();
  const incidents = useIncidentHistory();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [now] = useState(() => new Date());

  const apply = (next: IncidentFilters) => setParams(writeFilters(next), { replace: true });
  const update = (patch: Partial<IncidentFilters>) => apply({ ...filters, ...patch });
  const setPage = (p: number) => {
    const next = writeFilters(filters);
    if (p > 1) next.set('page', String(p));
    setParams(next, { replace: true });
  };

  const all = incidents.data ?? [];
  const options = pickerOptions(all);
  const shown = filterIncidents(all, filters, now);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const extra = drawerCount(filters);
  const chips = activeChips(filters, options);
  const status =
    filters.statuses.length === 1 ? filters.statuses[0]! : filters.statuses.length ? 'several' : '';
  const isAdmin = user.role === 'admin';

  return (
    <>
      <PageHeader
        title="Incidents"
        subtitle={
          isAdmin
            ? 'Read-only history of every fall alert and SOS, newest first.'
            : 'Records for the residents and rooms assigned to you, newest first.'
        }
        actions={
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlined />}
            disabled={shown.length === 0}
            onClick={() => downloadCsv(shown)}
          >
            Export CSV
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 3, alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          placeholder="Search by ID, resident or location"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search incidents' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="Date"
          value={filters.date}
          onChange={(e) => {
            const date = e.target.value as DatePreset;
            if (date === 'custom') setDrawerOpen(true);
            else update({ date, from: '', to: '' });
          }}
          sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
        >
          {(Object.keys(DATE_LABEL) as DatePreset[]).map((d) => (
            <MenuItem key={d} value={d}>
              {DATE_LABEL[d]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            update({ statuses: v === '' ? [] : [v as IncidentStatus] });
          }}
          sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {incidentStatusSchema.options.map((s) => (
            <MenuItem key={s} value={s}>
              {INCIDENT_STATUS_LABEL[s]}
            </MenuItem>
          ))}
          {status === 'several' && (
            <MenuItem value="several" disabled>
              {filters.statuses.length} statuses
            </MenuItem>
          )}
        </TextField>
        <Button variant="outlined" startIcon={<FilterListOutlined />} onClick={() => setDrawerOpen(true)}>
          {extra > 0 ? `More filters (${extra})` : 'More filters'}
        </Button>
      </Stack>

      {chips.length > 0 && (
        <Stack
          direction="row"
          sx={{ flexWrap: 'wrap', gap: 2, mb: 3 }}
          aria-label="Active filters"
          role="list"
        >
          {chips.map((c) => (
            <Chip key={c.key} role="listitem" label={c.label} onDelete={() => update(c.clear)} />
          ))}
        </Stack>
      )}

      <Box sx={{ mt: 2 }}>
        {incidents.isPending ? (
          <SkeletonRows rows={6} />
        ) : incidents.isError ? (
          <ErrorState error={incidents.error} onRetry={() => void incidents.refetch()} />
        ) : all.length === 0 ? (
          <Card sx={{ p: 8, textAlign: 'center' }}>
            <Typography color="text.secondary">No incidents recorded yet.</Typography>
          </Card>
        ) : shown.length === 0 ? (
          <Card sx={{ p: 8, textAlign: 'center' }}>
            <SearchOffOutlined sx={{ fontSize: 40, color: 'text.secondary' }} aria-hidden />
            <Typography variant="h6" component="p" sx={{ mt: 2 }}>
              No incidents match your search
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Try a different name or location, or clear the search and filters.
            </Typography>
            <Button variant="outlined" onClick={() => apply({ ...NO_FILTERS, date: 'all' })}>
              Clear search and filters
            </Button>
          </Card>
        ) : (
          <>
            <HistoryTable incidents={rows} />
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={3}
              sx={{ mt: 4, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
            >
              <Typography variant="body2" color="text.secondary">
                Showing {(current - 1) * PAGE_SIZE + 1}–{(current - 1) * PAGE_SIZE + rows.length} of{' '}
                {shown.length} {shown.length === 1 ? 'incident' : 'incidents'}
                {all.length >= HISTORY_LIMIT && ` (searching the latest ${HISTORY_LIMIT})`}
              </Typography>
              {pageCount > 1 && (
                <Pagination
                  count={pageCount}
                  page={current}
                  onChange={(_, p) => setPage(p)}
                  shape="rounded"
                  aria-label="Incident pages"
                />
              )}
            </Stack>
          </>
        )}
      </Box>

      <IncidentFilterDrawer
        open={drawerOpen}
        filters={filters}
        options={options}
        onClose={() => setDrawerOpen(false)}
        onApply={(f) => {
          apply(f);
          setDrawerOpen(false);
        }}
      />
    </>
  );
}
