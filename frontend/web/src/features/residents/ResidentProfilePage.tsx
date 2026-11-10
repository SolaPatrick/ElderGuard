import { useState, type ReactNode } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import LabelOutlined from '@mui/icons-material/LabelOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import { Link as RouterLink, useParams } from 'react-router';
import {
  FALL_RISK_LABEL,
  formatDate,
  incidentTitle,
  initials,
  type Camera,
  type Incident,
  type ResidentDetail,
} from '@elderguard/shared';
import { ApiError } from '../../api/client';
import { serverFeatures } from '../../api/endpoints';
import { useActiveIncidents, useCameras, useIncidents, useResident } from '../../api/queries';
import { useCurrentUser } from '../../auth/authContext';
import { CameraTile } from '../../components/CameraTile';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { SectionCard } from '../dashboard/DashboardCards';
import { alertForCamera } from '../monitoring/cameraFilters';
import { NotFoundPage } from '../system/NotFoundPage';
import { ArchiveDialog, CaregiversDialog, RestoreDialog, TransferRoomDialog } from './ResidentDialogs';
import { formatDateTime } from './residentFilters';
import { SEX_LABEL } from './residentEditing';

type DialogId = 'transfer' | 'caregivers' | 'archive' | 'restore';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'room', label: 'Room & Cameras' },
  { id: 'caregivers', label: 'Assigned Caregivers' },
  { id: 'incidents', label: 'Incident History' },
  { id: 'contacts', label: 'Emergency Contacts' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <Grid size={wide ? 12 : { xs: 12, sm: 6 }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {children}
      </Typography>
    </Grid>
  );
}

const roomLabel = (r: ResidentDetail) =>
  r.room ? `${r.room.name}${r.room.wing ? ` · ${r.room.wing}` : ''}` : 'No room assigned';

function Muted({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {children}
    </Typography>
  );
}

function IncidentList({ incidents, label }: { incidents: Incident[]; label: string }) {
  if (incidents.length === 0) return <Muted>No incidents recorded.</Muted>;
  return (
    <List dense disablePadding aria-label={label}>
      {incidents.map((i) => (
        <ListItem
          key={i.code}
          disableGutters
          secondaryAction={<StatusChip kind="incident" status={i.status} />}
        >
          <ListItemText
            sx={{ pr: 20 }}
            primary={
              <Link component={RouterLink} to={`/incidents/${i.code}`}>
                {i.code} · {incidentTitle(i)}
              </Link>
            }
            secondary={formatDateTime(i.detectedAt)}
          />
        </ListItem>
      ))}
    </List>
  );
}

function CaregiverList({ resident }: { resident: ResidentDetail }) {
  if (resident.caregivers.length === 0) return <Muted>No caregiver is assigned yet.</Muted>;
  return (
    <List dense disablePadding aria-label="Assigned caregivers">
      {resident.caregivers.map((c) => (
        <ListItem key={c.id} disableGutters>
          <ListItemAvatar>
            <Avatar sx={{ width: 32, height: 32, fontSize: 13 }} aria-hidden>
              {initials(c.fullName)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary={c.fullName} secondary="Caregiver" />
        </ListItem>
      ))}
    </List>
  );
}

function ContactList({ resident, limit }: { resident: ResidentDetail; limit?: number }) {
  const contacts = resident.emergencyContacts.slice(0, limit);
  if (contacts.length === 0) return <Muted>No emergency contact on file.</Muted>;
  return (
    <List dense disablePadding aria-label="Emergency contacts">
      {contacts.map((c) => (
        <ListItem
          key={c.id}
          disableGutters
          secondaryAction={
            c.phone && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<PhoneOutlined />}
                href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                aria-label={`Call ${c.fullName}`}
              >
                Call
              </Button>
            )
          }
        >
          <ListItemAvatar>
            <Avatar sx={{ width: 32, height: 32, fontSize: 13 }} aria-hidden>
              {initials(c.fullName)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            sx={{ pr: c.phone ? 20 : 0 }}
            primary={c.fullName}
            secondary={[c.relationship, c.phone].filter(Boolean).join(' · ')}
          />
        </ListItem>
      ))}
    </List>
  );
}

function CameraList({ cameras, alerts }: { cameras: Camera[]; alerts: Incident[] }) {
  if (cameras.length === 0) return <Muted>No camera covers this room.</Muted>;
  return (
    <Stack spacing={3}>
      {cameras.map((c) => (
        <CameraTile
          key={c.id}
          camera={c}
          alert={alertForCamera(c, alerts)}
          to={`/monitoring/${c.code}`}
          height={160}
          showDetection
        />
      ))}
    </Stack>
  );
}

/** RES-03 Resident profile (Admin/Head and caregiver). */
export function ResidentProfilePage() {
  const { id = '' } = useParams();
  const user = useCurrentUser();
  const resident = useResident(id);
  const incidents = useIncidents();
  const cameras = useCameras();
  const active = useActiveIncidents();
  const [tab, setTab] = useState<TabId>('overview');
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const isAdmin = user.role === 'admin';

  if (resident.isPending) return <LoadingBlock label="Loading resident" />;
  if (resident.isError) {
    if (resident.error instanceof ApiError && resident.error.status === 404) return <NotFoundPage />;
    return <ErrorState error={resident.error} onRetry={() => void resident.refetch()} />;
  }

  const r = resident.data;
  const theirIncidents = (incidents.data ?? []).filter((i) => i.resident?.id === r.id);
  const roomCameras = (cameras.data ?? []).filter((c) => r.room !== null && c.roomId === r.room.id);
  const alerts = active.data ?? [];
  const listName = isAdmin ? 'Residents' : 'My Residents';
  const closeDialog = () => setDialog(null);

  const details = (
    <SectionCard title="Details">
      <Grid container rowSpacing={4} columnSpacing={3}>
        <Fact label="Birth date">
          {r.birthDate
            ? `${formatDate(`${r.birthDate}T12:00:00Z`)}${r.age !== null ? ` (${r.age})` : ''}`
            : '—'}
        </Fact>
        <Fact label="Sex">{r.sex ? SEX_LABEL[r.sex] : '—'}</Fact>
        <Fact label="Room">{roomLabel(r)}</Fact>
        <Fact label="Fall-risk level">{FALL_RISK_LABEL[r.fallRisk]}</Fact>
        <Fact label="Mobility aid">{r.mobilityAid ?? 'None'}</Fact>
        <Fact label="Care notes" wide>
          {r.careNotes ?? '—'}
        </Fact>
      </Grid>
    </SectionCard>
  );

  const incidentsLoading = incidents.isPending ? <SkeletonRows rows={2} /> : null;

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to="/residents" color="inherit">
              {listName}
            </Link>{' '}
            / {r.fullName}
          </>
        }
        title={r.fullName}
        actions={
          isAdmin &&
          (r.isArchived ? (
            <Button variant="contained" onClick={() => setDialog('restore')}>
              Restore resident
            </Button>
          ) : (
            <>
              <Button variant="outlined" component={RouterLink} to={`/residents/${r.id}/edit`}>
                Edit resident
              </Button>
              <Button variant="outlined" onClick={() => setDialog('transfer')}>
                {r.room ? 'Transfer room' : 'Assign room'}
              </Button>
              {serverFeatures.residentDetails && (
                <Button variant="outlined" onClick={() => setDialog('caregivers')}>
                  Assign caregivers
                </Button>
              )}
              <Button variant="outlined" color="error" onClick={() => setDialog('archive')}>
                Archive
              </Button>
            </>
          ))
        }
      />

      {r.isArchived && (
        <Alert severity="info" sx={{ mb: 5 }}>
          {r.fullName} is archived. They are not in the resident lists or on new alerts; their incident
          history is kept.
        </Alert>
      )}

      <Card
        sx={{ mb: 5, ...(r.hasActiveAlert && { borderColor: 'eg.comp.alertBorderNew', borderWidth: 2 }) }}
      >
        <CardContent sx={{ p: 5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ alignItems: { sm: 'center' } }}>
            <Avatar sx={{ width: 64, height: 64, fontSize: 24 }} aria-hidden>
              {initials(r.fullName)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body1" color="text.secondary">
                {[r.age, r.sex ? SEX_LABEL[r.sex] : null, roomLabel(r)].filter((x) => x !== null).join(' · ')}
              </Typography>
              <Stack direction="row" sx={{ mt: 2, flexWrap: 'wrap', gap: 2 }}>
                <StatusChip kind="risk" risk={r.fallRisk} />
                {r.mobilityAid && (
                  <Chip size="small" variant="outlined" icon={<LabelOutlined />} label={r.mobilityAid} />
                )}
                {r.hasActiveAlert && (
                  <Chip
                    size="small"
                    label="Alert active"
                    sx={{ bgcolor: 'eg.sys.critical', color: 'eg.sys.onCritical' }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
        <Tabs
          value={tab}
          onChange={(_, v: TabId) => setTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Resident sections"
          sx={{ px: 3, borderTop: 1, borderColor: 'divider' }}
        >
          {TABS.map((t) => (
            <Tab key={t.id} value={t.id} label={t.label} />
          ))}
        </Tabs>
      </Card>

      {tab === 'overview' && (
        <Grid container spacing={5}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={5}>
              {details}
              <SectionCard
                title="Recent incidents"
                action={
                  theirIncidents.length > 2 ? (
                    <Button size="small" onClick={() => setTab('incidents')}>
                      View all
                    </Button>
                  ) : undefined
                }
              >
                {incidentsLoading ?? (
                  <IncidentList incidents={theirIncidents.slice(0, 2)} label="Recent incidents" />
                )}
              </SectionCard>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, lg: 4 }}>
            <Stack spacing={5}>
              <SectionCard title={r.room ? `${r.room.name} camera` : 'Camera'}>
                {cameras.isPending ? (
                  <SkeletonRows rows={1} />
                ) : (
                  <CameraList cameras={roomCameras.slice(0, 1)} alerts={alerts} />
                )}
              </SectionCard>
              <SectionCard title="Assigned caregivers">
                <CaregiverList resident={r} />
              </SectionCard>
              <SectionCard title="Emergency contact">
                <ContactList resident={r} limit={1} />
              </SectionCard>
            </Stack>
          </Grid>
        </Grid>
      )}
      {tab === 'room' && (
        <Grid container spacing={5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard title="Room">
              <Typography variant="body2">{roomLabel(r)}</Typography>
            </SectionCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <SectionCard title="Cameras">
              {cameras.isPending ? (
                <SkeletonRows rows={1} />
              ) : (
                <CameraList cameras={roomCameras} alerts={alerts} />
              )}
            </SectionCard>
          </Grid>
        </Grid>
      )}
      {tab === 'caregivers' && (
        <SectionCard title="Assigned caregivers">
          <CaregiverList resident={r} />
        </SectionCard>
      )}
      {tab === 'incidents' && (
        <SectionCard title="Incident history">
          {incidentsLoading ?? <IncidentList incidents={theirIncidents} label="Incident history" />}
        </SectionCard>
      )}
      {tab === 'contacts' && (
        <SectionCard title="Emergency contacts">
          <ContactList resident={r} />
        </SectionCard>
      )}

      {dialog === 'transfer' && <TransferRoomDialog resident={r} onClose={closeDialog} />}
      {dialog === 'caregivers' && <CaregiversDialog resident={r} onClose={closeDialog} />}
      {dialog === 'archive' && <ArchiveDialog resident={r} onClose={closeDialog} />}
      {dialog === 'restore' && <RestoreDialog resident={r} onClose={closeDialog} />}
    </>
  );
}
