import { Grid, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import {
  HELP_LIMITATIONS,
  HELP_STEPS,
  INCIDENT_STATUS_LABEL,
  STATUS_MEANING,
  type IncidentStatus,
} from '@elderguard/shared';
import { BACKEND, USE_MOCKS } from '../../api/config';
import { useCurrentUser } from '../../auth/authContext';
import { PageHeader } from '../../components/PageHeader';
import { StatusChip } from '../../components/StatusChip';
import { APP_VERSION } from '../../version';
import { SectionCard } from '../dashboard/DashboardCards';

/** PRF-04 Help & About. */
export function HelpPage() {
  const user = useCurrentUser();
  const server = USE_MOCKS ? 'demo data' : BACKEND === 'fastapi' ? 'ElderGuard server' : 'server';
  return (
    <>
      <PageHeader title="Help & About" />
      <Grid container spacing={5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="How alerts work">
            <List component="ol" disablePadding aria-label="How alerts work">
              {HELP_STEPS.map((s, i) => (
                <ListItem key={s.title} disableGutters sx={{ alignItems: 'flex-start' }}>
                  <ListItemText primary={`${i + 1}. ${s.title}`} secondary={s.body} />
                </ListItem>
              ))}
            </List>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={5}>
            <SectionCard title="What each status means">
              <List disablePadding aria-label="Statuses">
                {(Object.keys(STATUS_MEANING) as IncidentStatus[]).map((s) => (
                  <ListItem key={s} disableGutters sx={{ gap: 3 }}>
                    <StatusChip kind="incident" status={s} />
                    <ListItemText
                      primary={STATUS_MEANING[s]}
                      aria-label={`${INCIDENT_STATUS_LABEL[s]}: ${STATUS_MEANING[s]}`}
                    />
                  </ListItem>
                ))}
              </List>
            </SectionCard>
            <SectionCard title="Limitations">
              <Typography variant="body2">{HELP_LIMITATIONS}</Typography>
            </SectionCard>
            <SectionCard title="About">
              <Typography variant="body2">
                ElderGuard {APP_VERSION} (web) · connected to the {server}
              </Typography>
              {user.role !== 'admin' && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  For your account, password or assigned rooms, ask your Admin/Head.
                </Typography>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>
    </>
  );
}
