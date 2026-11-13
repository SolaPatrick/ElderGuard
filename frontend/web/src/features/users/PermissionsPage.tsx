import { useState } from 'react';
import {
  Alert,
  Box,
  Card,
  Link,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import { Link as RouterLink } from 'react-router';
import type { Role } from '@elderguard/shared';
import { serverFeatures } from '../../api/endpoints';
import { PageHeader } from '../../components/PageHeader';
import { ACTION_LABEL, ACTIONS, PERMISSIONS, type Access } from './permissions';
import { ROLE_LABEL } from './staffLabels';

const ROLES: Role[] = ['admin', 'employee'];

function Cell({ access }: { access: Access }) {
  if (access === null) {
    return (
      <Typography variant="body2" color="text.disabled" aria-label="Does not apply">
        —
      </Typography>
    );
  }
  const { icon, label, color } = {
    all: { icon: <CheckCircleOutlined fontSize="small" />, label: 'Yes', color: 'success.main' },
    assigned: { icon: <PlaceOutlined fontSize="small" />, label: 'Assigned areas', color: 'primary.main' },
    none: { icon: <BlockOutlined fontSize="small" />, label: 'No', color: 'text.secondary' },
  }[access];
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color, whiteSpace: 'nowrap' }}>
      {icon}
      <Typography variant="body2" component="span" sx={{ color: 'text.primary' }}>
        {label}
      </Typography>
    </Box>
  );
}

/** USR-09: what each role can do, as the app and server enforce it today. Read-only. */
export function PermissionsPage() {
  const [role, setRole] = useState<Role>('employee');

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        subtitle="What each role can do in ElderGuard"
        breadcrumb={
          <Link component={RouterLink} to="/users" color="inherit">
            Users & Access
          </Link>
        }
      />
      <Alert severity="info" sx={{ mb: 5 }}>
        These are the fixed rules for the two roles. Changing them, or giving one person extra rights, isn't
        possible yet because the server doesn't store permissions.
        {!serverFeatures.areaAssignment &&
          ' Rooms also can’t be assigned on this server yet, so for now employees see every room.'}
      </Alert>

      <Tabs value={role} onChange={(_, v: Role) => setRole(v)} aria-label="Role" sx={{ mb: 4 }}>
        {ROLES.map((r) => (
          <Tab key={r} value={r} label={ROLE_LABEL[r]} />
        ))}
      </Tabs>

      <TableContainer component={Card}>
        <Table aria-label={`Permissions for ${ROLE_LABEL[role]}`}>
          <TableHead>
            <TableRow>
              <TableCell>Module</TableCell>
              {ACTIONS.map((a) => (
                <TableCell key={a}>{ACTION_LABEL[a]}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {PERMISSIONS.map((p) => (
              <TableRow key={p.module}>
                <TableCell component="th" scope="row">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {p.module}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.note}
                  </Typography>
                </TableCell>
                {ACTIONS.map((a) => (
                  <TableCell key={a}>
                    <Cell access={p.access[role][a]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        “Assigned areas” means only the rooms and areas set on the employee’s page under Assign.
      </Typography>
    </>
  );
}
