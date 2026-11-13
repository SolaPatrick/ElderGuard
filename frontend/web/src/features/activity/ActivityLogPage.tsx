import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Drawer,
  IconButton,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { Link as RouterLink } from 'react-router';
import {
  activityActionSchema,
  activityModuleSchema,
  formatDate,
  formatTime,
  reportToCsv,
  type ActivityAction,
  type ActivityEntry,
  type ActivityModule,
} from '@elderguard/shared';
import { useActivity, useStaff } from '../../api/queries';
import { BACKEND, USE_MOCKS } from '../../api/config';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import { ROLE_LABEL } from '../users/staffLabels';

/** The log page loads this many of the latest entries and filters them in the browser. */
const LOG_LIMIT = 500;
const PAGE_SIZE = 25;

const ACTION_LABEL: Record<ActivityAction, string> = {
  logged_in: 'Logged in',
  acknowledged: 'Acknowledged',
  classified: 'Classified',
  resolved: 'Resolved',
  cancelled: 'Cancelled SOS',
  sent_sos: 'Sent SOS',
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  archived: 'Archived',
  restored: 'Restored',
  deactivated: 'Deactivated',
  reactivated: 'Reactivated',
  password_reset: 'Reset password',
  paused: 'Paused detection',
};

const MODULE_LABEL: Record<ActivityModule, string> = {
  auth: 'Sign-in',
  alerts: 'Alerts',
  cameras: 'Cameras',
  rooms: 'Rooms & areas',
  residents: 'Residents',
  users: 'Users & access',
};

/** Where a log entry's record can be opened, when it is something with its own page. */
function recordLink(e: ActivityEntry): string | null {
  if (!e.record) return null;
  if (e.module === 'alerts' && /^INC-/.test(e.record)) return `/incidents/${e.record}`;
  return null;
}

const when = (iso: string) => `${formatDate(iso)} · ${formatTime(iso)}`;

interface Filters {
  userId: string;
  action: '' | ActivityAction;
  module: '' | ActivityModule;
  from: string;
  to: string;
}
const NO_FILTERS: Filters = { userId: '', action: '', module: '', from: '', to: '' };

function matches(e: ActivityEntry, f: Filters): boolean {
  const day = new Date(e.createdAt);
  const local = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  return (
    (!f.userId || e.user.id === f.userId) &&
    (!f.action || e.action === f.action) &&
    (!f.module || e.module === f.module) &&
    (!f.from || local >= f.from) &&
    (!f.to || local <= f.to)
  );
}

function download(entries: ActivityEntry[], role: (id: string) => string) {
  const csv = reportToCsv(
    {
      title: 'Activity log',
      summary: [],
      tables: [
        {
          title: 'Entries',
          columns: ['Time', 'User', 'Role', 'Action', 'Module', 'Record', 'What happened'],
          rows: entries.map((e) => [
            when(e.createdAt),
            e.user.fullName,
            role(e.user.id),
            ACTION_LABEL[e.action],
            MODULE_LABEL[e.module],
            e.record ?? '',
            e.summary,
          ]),
          empty: '',
        },
      ],
    },
    [['Exported', when(new Date().toISOString())]],
  );
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** LOG-02: everything the log knows about one entry. */
function EntryDrawer({
  entry,
  role,
  onClose,
}: {
  entry: ActivityEntry | null;
  role: (id: string) => string;
  onClose: () => void;
}) {
  const link = entry && recordLink(entry);
  return (
    <Drawer
      anchor="right"
      open={entry !== null}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 420 } } } }}
    >
      {entry && (
        <Box sx={{ p: 6 }} role="region" aria-label="Log entry">
          <Stack direction="row" sx={{ alignItems: 'center', mb: 4 }}>
            <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
              Log entry
            </Typography>
            <IconButton aria-label="Close" onClick={onClose}>
              <Close />
            </IconButton>
          </Stack>
          <Typography sx={{ mb: 4 }}>{entry.summary}</Typography>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              columnGap: 4,
              rowGap: 2,
              m: 0,
              '& dd': { m: 0 },
            }}
          >
            {(
              [
                ['Time', when(entry.createdAt)],
                ['User', entry.user.fullName],
                ['Role', role(entry.user.id)],
                ['Action', ACTION_LABEL[entry.action]],
                ['Module', MODULE_LABEL[entry.module]],
                [
                  'Record',
                  link ? (
                    <Link key="record" component={RouterLink} to={link}>
                      {entry.record}
                    </Link>
                  ) : (
                    (entry.record ?? '—')
                  ),
                ],
              ] as const
            ).map(([k, v]) => (
              <Box key={k} sx={{ display: 'contents' }}>
                <Typography component="dt" variant="body2" color="text.secondary">
                  {k}
                </Typography>
                <Typography component="dd" variant="body2">
                  {v}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 6 }}>
            Before-and-after values for edits, and the device or IP address, are not shown because the server
            does not record them yet.
          </Typography>
        </Box>
      )}
    </Drawer>
  );
}

/** LOG-01: who did what, and when. Admin/Head only. */
export function ActivityLogPage() {
  const log = useActivity(LOG_LIMIT);
  const staff = useStaff();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<ActivityEntry | null>(null);

  const role = (id: string) => {
    const s = staff.data?.find((x) => x.id === id);
    return s ? ROLE_LABEL[s.role] : '—';
  };
  const entries = useMemo(() => (log.data ?? []).filter((e) => matches(e, f)), [log.data, f]);
  const users = useMemo(() => {
    const byId = new Map((log.data ?? []).map((e) => [e.user.id, e.user.fullName]));
    return [...byId].toSorted((a, b) => a[1].localeCompare(b[1]));
  }, [log.data]);
  const set = (change: Partial<Filters>) => {
    setF((x) => ({ ...x, ...change }));
    setPage(0);
  };
  const filtered = Object.values(f).some(Boolean);
  const onlyAlerts = !USE_MOCKS && BACKEND === 'fastapi';

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Who did what in ElderGuard, newest first"
        actions={
          <Button
            variant="outlined"
            startIcon={<DownloadOutlined />}
            disabled={entries.length === 0}
            onClick={() => download(entries, role)}
          >
            Export CSV
          </Button>
        }
      />
      {onlyAlerts && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          The server records who acknowledged, classified and resolved each alert. Sign-ins and changes to
          rooms, cameras, residents and accounts will appear once the server keeps a log of them.
        </Typography>
      )}

      <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap', mb: 4 }}>
        <TextField
          select
          size="small"
          fullWidth={false}
          label="User"
          value={f.userId}
          onChange={(e) => set({ userId: e.target.value })}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All users</MenuItem>
          {users.map(([id, name]) => (
            <MenuItem key={id} value={id}>
              {name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          fullWidth={false}
          label="Action"
          value={f.action}
          onChange={(e) => set({ action: e.target.value as Filters['action'] })}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All actions</MenuItem>
          {activityActionSchema.options.map((a) => (
            <MenuItem key={a} value={a}>
              {ACTION_LABEL[a]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          fullWidth={false}
          label="Module"
          value={f.module}
          onChange={(e) => set({ module: e.target.value as Filters['module'] })}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="">All modules</MenuItem>
          {activityModuleSchema.options.map((m) => (
            <MenuItem key={m} value={m}>
              {MODULE_LABEL[m]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          fullWidth={false}
          type="date"
          label="From"
          value={f.from}
          onChange={(e) => set({ from: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          fullWidth={false}
          type="date"
          label="To"
          value={f.to}
          onChange={(e) => set({ to: e.target.value })}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        {filtered && <Button onClick={() => set(NO_FILTERS)}>Clear filters</Button>}
      </Stack>

      {log.isPending ? (
        <SkeletonRows rows={6} />
      ) : log.isError ? (
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      ) : entries.length === 0 ? (
        <Typography color="text.secondary">
          {filtered ? 'No entries match these filters.' : 'Nothing has been logged yet.'}
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Showing {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            {log.data.length >= LOG_LIMIT ? ` from the latest ${LOG_LIMIT}` : ''}
          </Typography>
          <TableContainer component={Card}>
            <Table aria-label="Activity log">
              <TableHead>
                <TableRow>
                  <TableCell aria-sort="descending">Time ▼</TableCell>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell>Record</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      <Link
                        component="button"
                        type="button"
                        onClick={() => setOpen(e)}
                        aria-label={`${when(e.createdAt)}: ${e.summary}`}
                      >
                        {when(e.createdAt)}
                      </Link>
                    </TableCell>
                    <TableCell>{e.user.fullName}</TableCell>
                    <TableCell>{role(e.user.id)}</TableCell>
                    <TableCell>{ACTION_LABEL[e.action]}</TableCell>
                    <TableCell>{MODULE_LABEL[e.module]}</TableCell>
                    <TableCell>{e.record ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {entries.length > PAGE_SIZE && (
              <TablePagination
                component="div"
                count={entries.length}
                page={page}
                rowsPerPage={PAGE_SIZE}
                rowsPerPageOptions={[PAGE_SIZE]}
                onPageChange={(_, p) => setPage(p)}
              />
            )}
          </TableContainer>
        </>
      )}
      <EntryDrawer entry={open} role={role} onClose={() => setOpen(null)} />
    </>
  );
}
