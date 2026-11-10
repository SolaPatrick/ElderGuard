import { useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { FALL_RISK_LABEL, incidentTitle, initials } from '@elderguard/shared';
import { useCameras, useDeleteRoom, useIncidents, useResidents, useRooms } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock, SkeletonRows } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { SectionCard } from '../dashboard/DashboardCards';
import { formatDateTime } from '../residents/residentFilters';
import { NotFoundPage } from '../system/NotFoundPage';
import { RoomDialog } from './RoomDialog';
import { RoomStatusChip } from './RoomStatusChip';
import { roomRows, type RoomRow } from './roomStats';

const Muted = ({ children }: { children: string }) => (
  <Typography variant="body2" color="text.secondary">
    {children}
  </Typography>
);

/** ROOM-04: blocked while residents or cameras are assigned, otherwise a confirmation. */
function DeleteRoomDialog({ row, onClose }: { row: RoomRow; onClose: () => void }) {
  const navigate = useNavigate();
  const remove = useDeleteRoom(row.room.id);
  const [error, setError] = useState<string | null>(null);
  const { room, residents, cameras } = row;
  const blocked = residents.length > 0 || cameras.length > 0;

  if (blocked) {
    return (
      <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{room.name} can't be deleted yet</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 3 }}>Move everything below to another room first.</Typography>
          {residents.length > 0 && (
            <>
              <Typography variant="subtitle2" component="h3">
                {residents.length === 1 ? '1 resident' : `${residents.length} residents`} still assigned
              </Typography>
              <List dense disablePadding sx={{ mb: 3 }}>
                {residents.map((r) => (
                  <ListItem key={r.id} disableGutters>
                    <Link component={RouterLink} to={`/residents/${r.id}`}>
                      {r.fullName}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </>
          )}
          {cameras.length > 0 && (
            <>
              <Typography variant="subtitle2" component="h3">
                {cameras.length === 1 ? '1 camera' : `${cameras.length} cameras`} still assigned
              </Typography>
              <List dense disablePadding>
                {cameras.map((c) => (
                  <ListItem key={c.id} disableGutters>
                    <Link component={RouterLink} to={`/monitoring/${c.code}`}>
                      {c.code}
                    </Link>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button variant="contained" onClick={onClose}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const confirm = async () => {
    setError(null);
    try {
      await remove.mutateAsync();
      onClose();
      void navigate('/rooms', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Dialog open onClose={() => !remove.isPending && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>Delete {room.name}?</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} role="alert">
            {error}
          </Alert>
        )}
        <Typography>
          No residents or cameras are assigned to {room.name}. It will also be removed from the areas assigned
          to staff. This can't be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={remove.isPending}>
          Cancel
        </Button>
        <Button variant="contained" color="error" loading={remove.isPending} onClick={() => void confirm()}>
          Delete room
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** ROOM-03 Room detail (Admin/Head). */
export function RoomDetailPage() {
  const { id = '' } = useParams();
  const rooms = useRooms();
  const residents = useResidents();
  const cameras = useCameras();
  const incidents = useIncidents();
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null);

  if (rooms.isPending || residents.isPending || cameras.isPending)
    return <LoadingBlock label="Loading room" />;
  const failed = [rooms, residents, cameras].find((q) => q.isError);
  if (failed) return <ErrorState error={failed.error} onRetry={() => void failed.refetch()} />;

  const row = roomRows(rooms.data ?? [], residents.data ?? [], cameras.data ?? []).find(
    (r) => r.room.id === id,
  );
  if (!row) return <NotFoundPage />;
  const { room } = row;
  const history = (incidents.data ?? []).filter((i) => i.room.id === room.id);
  const wings = [...new Set((rooms.data ?? []).flatMap((r) => (r.wing ? [r.wing] : [])))].toSorted();

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link component={RouterLink} to="/rooms" color="inherit">
              Rooms &amp; Areas
            </Link>{' '}
            / {room.name}
          </>
        }
        title={room.name}
        subtitle={room.wing ?? 'No wing'}
        actions={
          <>
            <Button variant="outlined" onClick={() => setDialog('edit')}>
              Edit room
            </Button>
            <Button variant="outlined" color="error" onClick={() => setDialog('delete')}>
              Delete room
            </Button>
          </>
        }
      />

      <Grid container spacing={5}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title={`Residents in this room (${row.residents.length})`}>
            {row.residents.length === 0 ? (
              <Muted>No residents in this room.</Muted>
            ) : (
              <List dense disablePadding aria-label="Residents in this room">
                {row.residents.map((r) => (
                  <ListItem key={r.id} disableGutters>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 13 }} aria-hidden>
                        {initials(r.fullName)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Link component={RouterLink} to={`/residents/${r.id}`}>
                          {r.fullName}
                        </Link>
                      }
                      secondary={[r.age, FALL_RISK_LABEL[r.fallRisk]].filter((x) => x !== null).join(' · ')}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionCard title="Cameras" action={<RoomStatusChip status={row.status} />}>
            {row.cameras.length === 0 ? (
              <Muted>No camera covers this room, so falls here can't be detected.</Muted>
            ) : (
              <List dense disablePadding aria-label="Cameras in this room">
                {row.cameras.map((c) => (
                  <ListItem
                    key={c.id}
                    disableGutters
                    secondaryAction={<StatusChip kind="camera" status={c.status} />}
                  >
                    <ListItemText
                      sx={{ pr: 24 }}
                      primary={
                        <Link component={RouterLink} to={`/monitoring/${c.code}`}>
                          {c.code}
                        </Link>
                      }
                      secondary={c.detectionEnabled ? 'Detection on' : 'Detection off'}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </SectionCard>
        </Grid>
        <Grid size={12}>
          <SectionCard
            title="Recent incidents in this room"
            action={
              <Button size="small" component={RouterLink} to="/incidents">
                View all in Incidents
              </Button>
            }
          >
            {incidents.isPending ? (
              <SkeletonRows rows={2} />
            ) : history.length === 0 ? (
              <Muted>No incidents recorded.</Muted>
            ) : (
              <List dense disablePadding aria-label="Recent incidents in this room">
                {history.map((i) => (
                  <ListItem
                    key={i.code}
                    disableGutters
                    secondaryAction={<StatusChip kind="incident" status={i.status} />}
                  >
                    <ListItemText
                      sx={{ pr: 24 }}
                      primary={
                        <Link component={RouterLink} to={`/incidents/${i.code}`}>
                          {i.code} · {incidentTitle(i)}
                        </Link>
                      }
                      secondary={[i.resident?.fullName, formatDateTime(i.detectedAt)]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      {dialog === 'edit' && <RoomDialog room={room} wings={wings} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && <DeleteRoomDialog row={row} onClose={() => setDialog(null)} />}
    </>
  );
}
