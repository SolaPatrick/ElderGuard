import { Avatar, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import { initials } from '@elderguard/shared';
import { serverFeatures } from '../../api/endpoints';
import { useCurrentUser } from '../../auth/authContext';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../dashboard/DashboardCards';
import { ROLE_LABEL } from '../users/staffLabels';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Grid>
  );
}

/**
 * PRF-01 My profile. Read-only: no server lets staff edit their own account. The Admin/Head can
 * edit their own name and email under Users & access; employees ask the Admin/Head.
 */
export function ProfilePage() {
  const user = useCurrentUser();
  const isAdmin = user.role === 'admin';

  return (
    <>
      <PageHeader
        title="My profile"
        actions={
          isAdmin ? (
            <Button variant="outlined" component={RouterLink} to={`/users/${user.id}/edit`}>
              Edit my details
            </Button>
          ) : undefined
        }
      />
      <Grid container spacing={5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Personal details">
            <Stack direction="row" spacing={4} sx={{ alignItems: 'center', mb: 5 }}>
              <Avatar
                sx={{
                  width: 72,
                  height: 72,
                  bgcolor: 'eg.sys.primaryContainer',
                  color: 'eg.sys.onPrimaryContainer',
                  fontSize: 28,
                }}
              >
                {initials(user.fullName)}
              </Avatar>
              <Typography variant="h6" component="p">
                {user.fullName}
              </Typography>
            </Stack>
            <Grid container spacing={4}>
              <Fact label="Full name">{user.fullName}</Fact>
              <Fact label="Username">{user.username}</Fact>
              <Fact label="Email">{user.email ?? '—'}</Fact>
            </Grid>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Role and assignments">
            <Grid container spacing={4} sx={{ mb: 4 }}>
              <Fact label="Role">
                {ROLE_LABEL[user.role]}
                {user.title && user.title !== ROLE_LABEL[user.role] ? ` · ${user.title}` : ''}
              </Fact>
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
                  Assigned rooms and areas
                </Typography>
                {isAdmin ? (
                  <Typography variant="body2">All rooms and areas</Typography>
                ) : !serverFeatures.areaAssignment ? (
                  <Typography variant="body2">All rooms (rooms are not assigned to staff yet)</Typography>
                ) : user.areas.length === 0 ? (
                  <Typography variant="body2">None assigned yet</Typography>
                ) : (
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }} aria-label="Assigned rooms">
                    {user.areas.map((a) => (
                      <Chip
                        key={a.id}
                        size="small"
                        variant="outlined"
                        label={a.wing ? `${a.name} · ${a.wing}` : a.name}
                      />
                    ))}
                  </Stack>
                )}
              </Grid>
            </Grid>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              {isAdmin
                ? 'You can change your name and email with "Edit my details".'
                : 'Ask your Admin/Head to change your name, email, role or rooms.'}
            </Typography>
            <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                component={RouterLink}
                to="/change-password"
                state={{ from: '/profile' }}
              >
                Change password
              </Button>
              <Button variant="outlined" component={RouterLink} to="/profile/alerts">
                My alert preferences
              </Button>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
