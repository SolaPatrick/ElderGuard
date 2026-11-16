import { useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router';
import { formatDate, initials, type StaffMember } from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { serverFeatures } from '../../api/endpoints';
import { useResetStaffPassword, useSetStaffActive, useStaffMember } from '../../api/queries';
import { useCurrentUser } from '../../auth/authContext';
import { errorMessage } from '../../components/errorMessage';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { SectionCard } from '../dashboard/DashboardCards';
import { formatDateTime } from '../residents/residentFilters';
import { NotFoundPage } from '../system/NotFoundPage';
import { AssignDialog } from './AssignDialog';
import { CredentialsDialog } from './CredentialsDialog';
import { ROLE_LABEL } from './staffLabels';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ wordBreak: 'break-word' }}>
        {children}
      </Typography>
    </Grid>
  );
}

/** A yes/no question with the server's error shown inside, so the dialog stays open on failure. */
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  danger = false,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={() => !pending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} role="alert">
            {error}
          </Alert>
        )}
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={danger ? 'error' : 'primary'}
          loading={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** USR-10 summary on the user page, with the Assign button for employees. */
function AssignmentsCard({ staff }: { staff: StaffMember }) {
  const [assigning, setAssigning] = useState(false);
  const canAssign = staff.role === 'employee' && serverFeatures.areaAssignment;
  return (
    <SectionCard
      title="Assigned residents and areas"
      action={
        canAssign ? (
          <Button size="small" onClick={() => setAssigning(true)}>
            Assign
          </Button>
        ) : undefined
      }
    >
      {staff.role === 'admin' ? (
        <Typography variant="body2" color="text.secondary">
          The Admin/Head sees every room, area and resident.
        </Typography>
      ) : !serverFeatures.areaAssignment ? (
        <Typography variant="body2" color="text.secondary">
          Assigning rooms and residents is not available on the server yet, so employees see every room for
          now.
        </Typography>
      ) : (
        <Stack spacing={4}>
          {staff.areas.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No rooms assigned. This employee won't get any alerts until you assign some.
            </Typography>
          ) : (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }} aria-label="Assigned rooms">
              {staff.areas.map((a) => (
                <Chip key={a.id} variant="outlined" label={a.wing ? `${a.name} · ${a.wing}` : a.name} />
              ))}
            </Stack>
          )}
          <div>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 2 }}>
              Caregiver for
            </Typography>
            {staff.residents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No residents
              </Typography>
            ) : (
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }} aria-label="Assigned residents">
                {staff.residents.map((r) => (
                  <Chip
                    key={r.id}
                    variant="outlined"
                    label={r.fullName}
                    component={RouterLink}
                    to={`/residents/${r.id}`}
                    clickable
                  />
                ))}
              </Stack>
            )}
          </div>
        </Stack>
      )}
      {assigning && <AssignDialog staff={staff} onClose={() => setAssigning(false)} />}
    </SectionCard>
  );
}

type Open = 'deactivate' | 'reactivate' | 'reset' | null;

function UserActions({ staff, isSelf }: { staff: StaffMember; isSelf: boolean }) {
  const setActive = useSetStaffActive(staff.id);
  const reset = useResetStaffPassword(staff.id);
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState(true);
  const [password, setPassword] = useState<string | null>(null);

  const show = (dialog: Open) => {
    setError(null);
    setNewPassword(true);
    setOpen(dialog);
  };
  const pending = setActive.isPending || reset.isPending;

  const run = async (work: () => Promise<void>) => {
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deactivate = () =>
    run(async () => {
      await setActive.mutateAsync('deactivate');
      setOpen(null);
    });
  const reactivate = () =>
    run(async () => {
      if (!staff.isActive) await setActive.mutateAsync('reactivate');
      if (newPassword) setPassword((await reset.mutateAsync()).temporaryPassword);
      setOpen(null);
    });
  const resetPassword = () =>
    run(async () => {
      setPassword((await reset.mutateAsync()).temporaryPassword);
      setOpen(null);
    });

  return (
    <>
      <Button variant="outlined" component={RouterLink} to={`/users/${staff.id}/edit`}>
        Edit user
      </Button>
      {staff.isActive && (
        <Button variant="outlined" onClick={() => show('reset')}>
          Reset password
        </Button>
      )}
      {staff.isActive ? (
        <Tooltip title={isSelf ? "You can't deactivate your own account." : ''}>
          {/* The span keeps the tooltip working on a disabled button. */}
          <span>
            <Button variant="outlined" color="error" disabled={isSelf} onClick={() => show('deactivate')}>
              Deactivate
            </Button>
          </span>
        </Tooltip>
      ) : (
        <Button variant="contained" onClick={() => show('reactivate')}>
          Reactivate
        </Button>
      )}

      {open === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${staff.fullName}?`}
          confirmLabel="Deactivate user"
          danger
          pending={pending}
          error={error}
          onConfirm={() => void deactivate()}
          onClose={() => setOpen(null)}
        >
          <Typography>
            {staff.fullName} will be logged out and won't be able to log in. Their name stays on the incidents
            they handled. You can reactivate the account later.
          </Typography>
        </ConfirmDialog>
      )}
      {open === 'reactivate' && (
        <ConfirmDialog
          title={`Reactivate ${staff.fullName}?`}
          confirmLabel="Reactivate user"
          pending={pending}
          error={error}
          onConfirm={() => void reactivate()}
          onClose={() => setOpen(null)}
        >
          <Typography sx={{ mb: 3 }}>
            {staff.fullName} will be able to log in again
            {newPassword ? ' with a new temporary password.' : ' with their old password.'}
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={newPassword} onChange={(e) => setNewPassword(e.target.checked)} />}
            label="Issue a new temporary password"
          />
        </ConfirmDialog>
      )}
      {open === 'reset' && (
        <ConfirmDialog
          title={`Reset ${staff.fullName}'s password?`}
          confirmLabel="Reset password"
          pending={pending}
          error={error}
          onConfirm={() => void resetPassword()}
          onClose={() => setOpen(null)}
        >
          <Typography>
            Their current password stops working right away. You'll get a temporary password to give them, and
            they must change it when they log in.
          </Typography>
        </ConfirmDialog>
      )}
      {password && (
        <CredentialsDialog
          title="New temporary password"
          intro={`For ${staff.fullName} (${staff.username}).`}
          password={password}
          onClose={() => setPassword(null)}
        />
      )}
    </>
  );
}

/** USR-04 User detail, with USR-06 deactivate, USR-07 reactivate and USR-08 reset password. */
export function UserDetailPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const staff = useStaffMember(id);

  if (staff.isPending) return <LoadingBlock label="Loading user" />;
  if (staff.isError) {
    if (staff.error instanceof ApiError && staff.error.status === 404) return <NotFoundPage />;
    return <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />;
  }

  const s = staff.data;
  const isSelf = s.id === me.id;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to="/users" color="inherit">
              Users &amp; Access
            </Link>{' '}
            / {s.fullName}
          </>
        }
        title={s.fullName}
        actions={<UserActions staff={s} isSelf={isSelf} />}
      />

      <Card sx={{ mb: 5 }}>
        <CardContent sx={{ p: 5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ alignItems: { sm: 'center' } }}>
            <Avatar sx={{ width: 64, height: 64, fontSize: 24 }} aria-hidden>
              {initials(s.fullName)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography color="text.secondary">
                {[ROLE_LABEL[s.role], s.username].join(' · ')}
                {isSelf && ' · You'}
              </Typography>
              <Stack direction="row" sx={{ mt: 2, flexWrap: 'wrap', gap: 2 }}>
                <StatusChip kind="account" active={s.isActive} />
                {s.mustChangePassword && s.isActive && (
                  <Chip size="small" variant="outlined" label="Temporary password not changed yet" />
                )}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Profile">
            <Grid container rowSpacing={4} columnSpacing={3}>
              <Fact label="Username">{s.username}</Fact>
              <Fact label="Email">{s.email ?? '—'}</Fact>
              <Fact label="Last login">{formatDateTime(s.lastLoginAt)}</Fact>
              <Fact label="Created">{formatDate(s.createdAt)}</Fact>
              <Fact label="Role">{ROLE_LABEL[s.role]}</Fact>
            </Grid>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <AssignmentsCard staff={s} />
        </Grid>
      </Grid>
    </>
  );
}
