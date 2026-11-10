import { Grid, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { INCIDENT_STATUS_LABEL, type IncidentStatus } from '@elderguard/shared';
import { BACKEND, USE_MOCKS } from '../../api/config';
import { useCurrentUser } from '../../auth/authContext';
import { PageHeader } from '../../components/PageHeader';
import { StatusChip } from '../../components/StatusChip';
import { APP_VERSION } from '../../version';
import { SectionCard } from '../dashboard/DashboardCards';

const STEPS = [
  {
    title: 'Possible fall detected',
    body: 'A camera sees a possible fall and the alarm sounds on every signed-in screen, with the room and camera.',
  },
  { title: 'Acknowledge', body: 'Tell the team you are responding. The alarm stops for everyone.' },
  { title: 'Go to the resident', body: 'Open the live camera, or go to the room in person.' },
  { title: 'Classify', body: 'Mark it as a confirmed incident, or as a false alarm with a reason.' },
  { title: 'Resolve', body: 'Choose the outcome and write a short summary of what you did.' },
];

const STATUS_MEANING: Record<IncidentStatus, string> = {
  new: 'Nobody has acknowledged it yet',
  acknowledged: 'Someone is responding',
  confirmed: 'A real fall or emergency',
  false_alarm: 'No fall happened',
  resolved: 'Closed with an outcome',
};

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
              {STEPS.map((s, i) => (
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
              <Typography variant="body2">
                ElderGuard is an assistive tool. It does not replace rounds and in-person checks. A camera can
                miss a fall it cannot see clearly (outside its view, blocked, or in poor light), and it can
                raise false alarms. Always respond to a resident who calls for help, whatever the screen
                shows.
              </Typography>
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
