import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  InputAdornment,
  Link,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useCameras, useResidents, useRooms } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { RoomDialog } from './RoomDialog';
import { RoomStatusChip } from './RoomStatusChip';
import { filterRooms, roomRows, wingOf } from './roomStats';

/** ROOM-01 Rooms & areas list (Admin/Head). */
export function RoomsPage() {
  const navigate = useNavigate();
  const rooms = useRooms();
  const residents = useResidents();
  const cameras = useCameras();
  const [search, setSearch] = useState('');
  const [wing, setWing] = useState('');
  const [adding, setAdding] = useState(false);

  const all = roomRows(rooms.data ?? [], residents.data ?? [], cameras.data ?? []);
  const shown = filterRooms(all, { search, wing });
  const wings = [...new Set(all.map((r) => wingOf(r.room)))].toSorted((a, b) => a.localeCompare(b));
  const knownWings = [...new Set((rooms.data ?? []).flatMap((r) => (r.wing ? [r.wing] : [])))].toSorted();
  const query = [rooms, residents, cameras].find((q) => q.isError);

  return (
    <>
      <PageHeader
        title="Rooms & Areas"
        subtitle="Rooms must exist before residents and cameras can be assigned to them."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setAdding(true)}>
            Add room
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 5 }}>
        <TextField
          size="small"
          placeholder="Search rooms and areas"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search rooms and areas' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          size="small"
          label="Wing / floor"
          value={wing}
          onChange={(e) => setWing(e.target.value)}
          sx={{ width: { xs: '100%', md: 200 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {wings.map((w) => (
            <MenuItem key={w} value={w}>
              {w}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {rooms.isPending || residents.isPending || cameras.isPending ? (
        <LoadingBlock label="Loading rooms" />
      ) : query ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : shown.length === 0 ? (
        <Card sx={{ p: 8, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {all.length === 0 ? 'No rooms yet. Add the first one.' : 'No rooms match your search.'}
          </Typography>
        </Card>
      ) : (
        <>
          <TableContainer component={Card}>
            <Table aria-label="Rooms and areas">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Wing / floor</TableCell>
                  <TableCell align="right">Residents</TableCell>
                  <TableCell align="right">Cameras</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map(({ room, residents: people, cameras: cams, status }) => (
                  <TableRow key={room.id} hover>
                    <TableCell>
                      <Link component={RouterLink} to={`/rooms/${room.id}`} sx={{ fontWeight: 600 }}>
                        {room.name}
                      </Link>
                    </TableCell>
                    <TableCell>{room.wing ?? '—'}</TableCell>
                    <TableCell align="right">{people.length}</TableCell>
                    <TableCell align="right">{cams.length}</TableCell>
                    <TableCell>
                      <RoomStatusChip status={status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {shown.length} of {all.length} rooms and areas
            </Typography>
          </Box>
        </>
      )}

      {adding && (
        <RoomDialog
          room={null}
          wings={knownWings}
          onClose={() => setAdding(false)}
          onSaved={(room) => void navigate(`/rooms/${room.id}`)}
        />
      )}
    </>
  );
}
