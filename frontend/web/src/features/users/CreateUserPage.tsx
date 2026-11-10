import { useState } from 'react';
import { Button, Card, CardContent, Link, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router';
import type { StaffWithPassword } from '@elderguard/shared';
import { useCreateStaff } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { PageHeader } from '../../components/PageHeader';
import { CredentialsDialog } from './CredentialsDialog';
import { STAFF_FORM_ID, StaffForm } from './StaffForm';

/** USR-02 Create user, then USR-03 the sign-in details (shown once). */
export function CreateUserPage() {
  const navigate = useNavigate();
  const create = useCreateStaff();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<StaffWithPassword | null>(null);

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to="/users" color="inherit">
              Users &amp; Access
            </Link>{' '}
            / Create user
          </>
        }
        title="Create user"
        actions={
          <>
            <Button component={RouterLink} to="/users" disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" form={STAFF_FORM_ID} variant="contained" loading={create.isPending}>
              Create user
            </Button>
          </>
        }
      />
      <StaffForm
        mode="create"
        initial={{ fullName: '', username: '', email: '', role: 'employee', areaIds: [] }}
        submitError={submitError}
        onSubmit={async (values) => {
          setSubmitError(null);
          try {
            setCreated(await create.mutateAsync(values));
          } catch (err) {
            setSubmitError(errorMessage(err));
          }
        }}
        footer={
          <Card>
            <CardContent sx={{ p: 5 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Sign-in
              </Typography>
              <Typography variant="body2" color="text.secondary">
                A temporary password is created for the new user and shown once, right after you create the
                account. They must change it when they first log in.
              </Typography>
            </CardContent>
          </Card>
        }
      />
      {created && (
        <CredentialsDialog
          title="User created"
          intro={`Share these sign-in details with ${created.user.fullName}.`}
          username={created.user.username}
          password={created.temporaryPassword}
          onClose={() => void navigate(`/users/${created.user.id}`, { replace: true })}
        />
      )}
    </>
  );
}
