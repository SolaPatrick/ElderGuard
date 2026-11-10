import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useLocation, useParams } from 'react-router';
import {
  formatDate,
  formatElapsed,
  formatTime,
  formatTimeWithSeconds,
  incidentPersonName,
  incidentTitle,
  isActiveStatus,
  secondsBetween,
  type IncidentDetail,
  type IncidentEventAction,
} from '@elderguard/shared';
import { useAcknowledge, useIncident } from '../../api/queries';
import { ApiError } from '../../api/client';
import { CameraSnapshot } from '../../components/CameraSnapshot';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { errorMessage } from '../../components/errorMessage';
import { StatusChip } from '../../components/StatusChip';
import { useNow } from '../../hooks/useNow';
import { NotFoundPage } from '../system/NotFoundPage';
import { ClassifyDialog } from './ClassifyDialog';
import { ResolveDialog } from './ResolveDialog';
import { AddNoteDialog } from './AddNoteDialog';
import { useCurrentUser } from '../../auth/authContext';
import { CancelSosDialog, SosStatusCard } from '../sos/SosStatus';

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={6}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Grid>
  );
}

const STEPS: { action: IncidentEventAction; label: string }[] = [
  { action: 'detected', label: 'Detected' },
  { action: 'acknowledged', label: 'Acknowledged' },
  { action: 'classified', label: 'Classified' },
  { action: 'resolved', label: 'Resolved' },
];

/** ALT-02 status timeline: each step shows when and by whom, or "Waiting". */
function StatusTimeline({ incident }: { incident: IncidentDetail }) {
  const closedAsFalseAlarm = incident.status === 'false_alarm';
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Status timeline">
      {STEPS.map((step, idx) => {
        const event = incident.events.findLast((e) => e.action === step.action);
        const skipped = step.action === 'resolved' && closedAsFalseAlarm;
        const done = event !== undefined || skipped;
        const isLast = idx === STEPS.length - 1;
        let detail = 'Waiting';
        if (event) {
          detail = [formatTimeWithSeconds(event.occurredAt), event.user?.fullName, event.detail]
            .filter(Boolean)
            .join(' · ');
        } else if (skipped) {
          detail = 'Closed as false alarm';
        }
        return (
          <Box component="li" key={step.action} sx={{ display: 'flex', gap: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5 }}>
              <Box
                aria-hidden
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: 2,
                  borderColor: done ? 'eg.sys.primary' : 'eg.sys.outline',
                  bgcolor: done ? 'eg.sys.primary' : 'transparent',
                }}
              />
              {!isLast && (
                <Box
                  aria-hidden
                  sx={{
                    width: 2,
                    flex: 1,
                    minHeight: 28,
                    bgcolor: done ? 'eg.sys.primary' : 'eg.sys.outlineVariant',
                  }}
                />
              )}
            </Box>
            <Box sx={{ pb: isLast ? 0 : 3 }}>
              <Typography variant="subtitle2" color={done ? 'text.primary' : 'text.secondary'}>
                {step.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {detail}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/** ALT-02 (open alert) and INC-03 / INC-04 (closed incident) share this page. */
export function AlertDetailPage() {
  const { code = '' } = useParams();
  const location = useLocation();
  const fromIncidents = location.pathname.startsWith('/incidents');
  const query = useIncident(code);
  const acknowledge = useAcknowledge();
  const now = useNow();
  const user = useCurrentUser();
  const [dialog, setDialog] = useState<'classify' | 'resolve' | 'note' | 'cancel-sos' | null>(null);

  if (query.isPending) return <LoadingBlock label="Loading alert" />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />;
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const incident = query.data;
  const open = isActiveStatus(incident.status);
  const elapsedEnd = incident.resolvedAt ? Date.parse(incident.resolvedAt) : now;
  const where = [incident.room.name, incident.room.wing].filter(Boolean).join(' · ');
  const isSos = incident.type === 'sos';
  const mySos = isSos && open && incident.sentBy?.id === user.id;
  const canCancelSos = isSos && open && (incident.sentBy?.id === user.id || user.role === 'admin');

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to={fromIncidents ? '/incidents' : '/alerts'} color="inherit">
              {fromIncidents ? 'Incidents' : 'Alerts'}
            </Link>{' '}
            / {incident.code}
          </>
        }
        title={incident.type === 'sos' ? `SOS · ${incident.room.name}` : incidentTitle(incident)}
        subtitle={`${incidentPersonName(incident)} · ${incident.room.name} · ${formatTime(incident.detectedAt)} · ${formatDate(incident.detectedAt)}`}
        actions={<StatusChip kind="incident" status={incident.status} />}
      />

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <CameraSnapshot
            src={incident.snapshotUrl}
            alerting={incident.status === 'new'}
            minHeight={360}
            timeLabel={formatTimeWithSeconds(incident.detectedAt)}
            caption={
              incident.camera
                ? `Evidence · snapshot · ${incident.camera.code}`
                : 'No camera for this alert (SOS)'
            }
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={4}>
            {mySos && <SosStatusCard incident={incident} onCancel={() => setDialog('cancel-sos')} />}
            <Card>
              <CardContent sx={{ p: 5 }}>
                <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
                  Details
                </Typography>
                <Grid container spacing={3}>
                  <Detail
                    label={incident.type === 'sos' ? 'Sent by' : 'Resident'}
                    value={incidentPersonName(incident)}
                  />
                  <Detail label="Room" value={where} />
                  <Detail label="Camera" value={incident.camera?.code ?? '—'} />
                  <Detail
                    label="Date and time"
                    value={`${formatTime(incident.detectedAt)} · ${formatDate(incident.detectedAt)}`}
                  />
                  <Detail
                    label="Detection confidence"
                    value={incident.confidence === null ? '—' : `${Math.round(incident.confidence * 100)}%`}
                  />
                  <Detail
                    label={open ? 'Elapsed' : 'Time to close'}
                    value={formatElapsed(secondsBetween(incident.detectedAt, elapsedEnd))}
                  />
                  {incident.outcome && <Detail label="Outcome" value={incident.outcome} />}
                  {incident.falseAlarmReason && (
                    <Detail label="False alarm reason" value={incident.falseAlarmReason} />
                  )}
                </Grid>
              </CardContent>
            </Card>
            <Card>
              <CardContent sx={{ p: 5 }}>
                <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
                  Status timeline
                </Typography>
                <StatusTimeline incident={incident} />
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent sx={{ p: 5 }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Response notes
              </Typography>
              {incident.notes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No notes yet.
                </Typography>
              ) : (
                <Stack spacing={3}>
                  {incident.notes.map((n) => (
                    <Box key={n.id}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {n.body}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {n.author.fullName} · {formatTime(n.createdAt)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={12}>
          <Card>
            <CardContent sx={{ p: 5 }}>
              {acknowledge.isError && (
                <Alert severity="warning" sx={{ mb: 4 }}>
                  {errorMessage(acknowledge.error)}
                </Alert>
              )}
              <Stack direction="row" spacing={3} useFlexGap sx={{ flexWrap: 'wrap' }}>
                {incident.status === 'new' && (
                  <Button
                    variant="contained"
                    loading={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(incident.code)}
                  >
                    Acknowledge
                  </Button>
                )}
                {incident.status === 'acknowledged' && (
                  <Button variant="contained" onClick={() => setDialog('classify')}>
                    Classify
                  </Button>
                )}
                {incident.status === 'confirmed' && (
                  <Button variant="contained" onClick={() => setDialog('resolve')}>
                    Resolve
                  </Button>
                )}
                <Button variant="outlined" onClick={() => setDialog('note')}>
                  Add note
                </Button>
                {canCancelSos && !mySos && (
                  <Button variant="outlined" color="error" onClick={() => setDialog('cancel-sos')}>
                    Cancel SOS
                  </Button>
                )}
                {incident.camera && (
                  <Button variant="outlined" component={RouterLink} to="/monitoring">
                    View live camera
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ClassifyDialog open={dialog === 'classify'} incident={incident} onClose={() => setDialog(null)} />
      <ResolveDialog open={dialog === 'resolve'} incident={incident} onClose={() => setDialog(null)} />
      <AddNoteDialog open={dialog === 'note'} incident={incident} onClose={() => setDialog(null)} />
      {canCancelSos && (
        <CancelSosDialog open={dialog === 'cancel-sos'} incident={incident} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
