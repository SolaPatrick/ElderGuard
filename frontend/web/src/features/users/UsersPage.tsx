import { useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
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
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { Link as RouterLink } from 'react-router';
import { initials, roleSchema, type Role } from '@elderguard/shared';
import { useStaff } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { formatDateTime } from '../residents/residentFilters';
import { areasLabel, filterStaff, ROLE_LABEL, type StatusFilter } from './staffLabels';

/** USR-01 User list (Admin/Head). */
export function UsersPage() {
  const staff = useStaff();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<StatusFilter>('');

  const all = staff.data ?? [];
  const shown = filterStaff(all, { search, role, status });
  const active = all.filter((s) => s.isActive).length;

  return (
    <>
      <PageHeader
        title="Users & Access"
        subtitle={
          staff.data
            ? `${all.length} ${all.length === 1 ? 'account' : 'accounts'} · ${active} active`
            : undefined
        }
        actions={
          <Stack direction="row" spacing={2}>
            <Button variant="outlined" component={RouterLink} to="/users/permissions">
              Roles & permissions
            </Button>
            <Button variant="contained" startIcon={<AddOutlined />} component={RouterLink} to="/users/new">
              Create user
            </Button>
          </Stack>
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 5 }}>
        <TextField
          size="small"
          placeholder="Search users"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search users' },
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
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role | '')}
          sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {roleSchema.options.map((r) => (
            <MenuItem key={r} value={r}>
              {ROLE_LABEL[r]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          sx={{ width: { xs: '100%', md: 180 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="deactivated">Deactivated</MenuItem>
        </TextField>
      </Stack>

      {staff.isPending ? (
        <LoadingBlock label="Loading users" />
      ) : staff.isError ? (
        <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />
      ) : shown.length === 0 ? (
        <Card sx={{ p: 8, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {all.length === 0 ? 'No accounts yet.' : 'No users match your search.'}
          </Typography>
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table aria-label="Users">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Assigned areas</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last login</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <Stack direction="row" spacing={3} sx={{ alignItems: 'center' }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 13 }} aria-hidden>
                        {initials(s.fullName)}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Link component={RouterLink} to={`/users/${s.id}`} sx={{ fontWeight: 600 }}>
                          {s.fullName}
                        </Link>
                        <Typography variant="body2" color="text.secondary">
                          {s.username}
                        </Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell>{ROLE_LABEL[s.role]}</TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>{areasLabel(s)}</TableCell>
                  <TableCell>
                    <StatusChip kind="account" active={s.isActive} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(s.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
