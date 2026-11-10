import { useState } from 'react';
import { Button, Link } from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { ApiError } from '../../api/client';
import { useStaffMember, useUpdateStaff } from '../../api/queries';
import { useAuth, useCurrentUser } from '../../auth/authContext';
import { errorMessage } from '../../components/errorMessage';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { NotFoundPage } from '../system/NotFoundPage';
import { STAFF_FORM_ID, StaffForm } from './StaffForm';

/** USR-05 Edit user. */
export function EditUserPage() {
  const { id = '' } = useParams();
  const me = useCurrentUser();
  const { updateCurrentUser } = useAuth();
  const navigate = useNavigate();
  const staff = useStaffMember(id);
  const update = useUpdateStaff(id);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (staff.isPending) return <LoadingBlock label="Loading user" />;
  if (staff.isError) {
    if (staff.error instanceof ApiError && staff.error.status === 404) return <NotFoundPage />;
    return <ErrorState error={staff.error} onRetry={() => void staff.refetch()} />;
  }

  const s = staff.data;
  const back = `/users/${s.id}`;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to="/users" color="inherit">
              Users &amp; Access
            </Link>{' '}
            /{' '}
            <Link component={RouterLink} to={back} color="inherit">
              {s.fullName}
            </Link>{' '}
            / Edit
          </>
        }
        title="Edit user"
        actions={
          <>
            <Button component={RouterLink} to={back} disabled={update.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={STAFF_FORM_ID} variant="contained" loading={update.isPending}>
              Save changes
            </Button>
          </>
        }
      />
      <StaffForm
        // A fresh form if the account is opened again after a change elsewhere.
        key={s.id}
        mode="edit"
        lockRole={s.id === me.id}
        initial={{
          fullName: s.fullName,
          username: s.username,
          email: s.email ?? '',
          role: s.role,
          areaIds: s.areas.map((a) => a.id),
        }}
        submitError={submitError}
        onSubmit={async ({ username: _u, ...values }) => {
          setSubmitError(null);
          try {
            const updated = await update.mutateAsync(values);
            if (updated.id === me.id) {
              const { isActive: _a, lastLoginAt: _l, createdAt: _c, ...user } = updated;
              updateCurrentUser(user);
            }
            void navigate(back);
          } catch (err) {
            setSubmitError(errorMessage(err));
          }
        }}
      />
    </>
  );
}
