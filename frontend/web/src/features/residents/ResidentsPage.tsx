import { useState } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  InputAdornment,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { Link as RouterLink } from 'react-router';
import { FALL_RISK_LABEL, fallRiskSchema, initials, type FallRisk, type Resident } from '@elderguard/shared';
import { useResidents } from '../../api/queries';
import { useCurrentUser } from '../../auth/authContext';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import {
  filterResidents,
  formatDateTime,
  loadView,
  roomOptions,
  roomOf,
  saveView,
  type ResidentView,
} from './residentFilters';

const ActiveAlertChip = () => (
  <Chip size="small" label="Alert active" sx={{ bgcolor: 'eg.sys.critical', color: 'eg.sys.onCritical' }} />
);

function ResidentTable({ residents }: { residents: Resident[] }) {
  return (
    <TableContainer component={Card}>
      <Table aria-label="Residents">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Age</TableCell>
            <TableCell>Room</TableCell>
            <TableCell>Fall risk</TableCell>
            <TableCell>Assigned caregivers</TableCell>
            <TableCell>Last incident</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {residents.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell>
                <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: 13 }} aria-hidden>
                    {initials(r.fullName)}
                  </Avatar>
                  <Link component={RouterLink} to={`/residents/${r.id}`} sx={{ fontWeight: 600 }}>
                    {r.fullName}
                  </Link>
                  {r.hasActiveAlert && <ActiveAlertChip />}
                </Stack>
              </TableCell>
              <TableCell>{r.age ?? '—'}</TableCell>
              <TableCell>{roomOf(r)}</TableCell>
              <TableCell>
                <StatusChip kind="risk" risk={r.fallRisk} />
              </TableCell>
              <TableCell>{r.caregivers.map((c) => c.fullName).join(', ') || '—'}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(r.lastIncidentAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ResidentCards({ residents }: { residents: Resident[] }) {
  return (
    <Box
      component="ul"
      aria-label="Residents"
      sx={{
        listStyle: 'none',
        p: 0,
        m: 0,
        display: 'grid',
        gap: 4,
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
      }}
    >
      {residents.map((r) => (
        <li key={r.id}>
          <Card sx={{ height: '100%', ...(r.hasActiveAlert && { borderColor: 'eg.comp.alertBorderNew' }) }}>
            <CardActionArea component={RouterLink} to={`/residents/${r.id}`} sx={{ height: '100%' }}>
              <CardContent sx={{ p: 5 }}>
                <Stack direction="row" spacing={3} sx={{ alignItems: 'center', mb: 3 }}>
                  <Avatar aria-hidden>{initials(r.fullName)}</Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{r.fullName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {[r.age, r.room?.name].filter((x) => x !== null && x !== undefined).join(' · ')}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <StatusChip kind="risk" risk={r.fallRisk} />
                  {r.hasActiveAlert && <ActiveAlertChip />}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Last incident: {formatDateTime(r.lastIncidentAt)}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </li>
      ))}
    </Box>
  );
}

/** RES-01 Resident list (Admin/Head) and "My Residents" (caregiver). */
export function ResidentsPage() {
  const user = useCurrentUser();
  const isAdmin = user.role === 'admin';
  const residents = useResidents();
  const [view, setView] = useState<ResidentView>(() => loadView(isAdmin ? 'table' : 'cards'));
  const [search, setSearch] = useState('');
  const [room, setRoom] = useState('');
  const [risk, setRisk] = useState<FallRisk | ''>('');

  const all = residents.data ?? [];
  const shown = filterResidents(all, { search, room, risk });
  const count = `${all.length} ${all.length === 1 ? 'resident' : 'residents'}`;

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Residents' : 'My Residents'}
        subtitle={
          residents.data ? (isAdmin ? `${count} in the facility` : `${count} assigned to you`) : undefined
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 5, alignItems: { md: 'center' } }}>
        <TextField
          size="small"
          placeholder="Search residents"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search residents' },
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
          label="Room / area"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {roomOptions(all).map((r) => (
            <MenuItem key={r} value={r}>
              {r}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Fall risk"
          value={risk}
          onChange={(e) => setRisk(e.target.value as FallRisk | '')}
          sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {fallRiskSchema.options.toReversed().map((r) => (
            <MenuItem key={r} value={r}>
              {FALL_RISK_LABEL[r]}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          aria-label="View"
          onChange={(_, value: ResidentView | null) => {
            if (value === null) return;
            setView(value);
            saveView(value);
          }}
        >
          <ToggleButton value="cards" sx={{ px: 4 }}>
            Cards
          </ToggleButton>
          <ToggleButton value="table" sx={{ px: 4 }}>
            Table
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {residents.isPending ? (
        <LoadingBlock label="Loading residents" />
      ) : residents.isError ? (
        <ErrorState error={residents.error} onRetry={() => void residents.refetch()} />
      ) : shown.length === 0 ? (
        <Card sx={{ p: 8, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {all.length === 0
              ? isAdmin
                ? 'No residents yet.'
                : 'No residents are assigned to you yet.'
              : 'No residents match your search.'}
          </Typography>
        </Card>
      ) : (
        <>
          {view === 'table' ? <ResidentTable residents={shown} /> : <ResidentCards residents={shown} />}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
            Showing {shown.length} of {all.length} residents
          </Typography>
        </>
      )}
    </>
  );
}
