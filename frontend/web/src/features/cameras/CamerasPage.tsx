import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { Link as RouterLink } from 'react-router';
import { CAMERA_STATUS_LABEL, cameraStatusSchema, type CameraStatus } from '@elderguard/shared';
import { useCameras } from '../../api/queries';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import { StatusChip } from '../../components/StatusChip';
import { areaOf, areaOptions, filterCameras } from '../monitoring/cameraFilters';
import { lastSeenLabel } from './cameraLabels';

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <Card sx={{ flex: 1, minWidth: 140 }}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" component="p" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** CAM-01 Camera list (Admin/Head). */
export function CamerasPage() {
  const cameras = useCameras();
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState<CameraStatus | ''>('');

  const all = cameras.data ?? [];
  const shown = filterCameras(all, area, search).filter((c) => status === '' || c.status === status);
  const count = (s: CameraStatus) => all.filter((c) => c.status === s).length;

  return (
    <>
      <PageHeader
        title="Cameras & Devices"
        subtitle={cameras.data ? `${all.length} ${all.length === 1 ? 'camera' : 'cameras'}` : undefined}
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} component={RouterLink} to="/cameras/new">
            Register camera
          </Button>
        }
      />

      {cameras.data && (
        <Stack direction="row" sx={{ mb: 5, gap: 3, flexWrap: 'wrap' }} aria-label="Camera status counts">
          <Tile label="Online" value={count('online')} />
          <Tile label="Offline" value={count('offline')} />
          <Tile label="Error" value={count('error')} />
          <Tile label="Detection paused" value={count('paused')} />
        </Stack>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 5 }}>
        <TextField
          size="small"
          placeholder="Search cameras"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}
          slotProps={{
            htmlInput: { 'aria-label': 'Search cameras' },
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
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as CameraStatus | '')}
          sx={{ width: { xs: '100%', md: 200 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {cameraStatusSchema.options.map((s) => (
            <MenuItem key={s} value={s}>
              {CAMERA_STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          sx={{ width: { xs: '100%', md: 200 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All</MenuItem>
          {areaOptions(all).map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {cameras.isPending ? (
        <LoadingBlock label="Loading cameras" />
      ) : cameras.isError ? (
        <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />
      ) : shown.length === 0 ? (
        <Card sx={{ p: 8, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {all.length === 0 ? 'No cameras yet. Register the first one.' : 'No cameras match your search.'}
          </Typography>
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table aria-label="Cameras">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Room</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last seen</TableCell>
                <TableCell>Detection</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Link component={RouterLink} to={`/cameras/${c.id}`} sx={{ fontWeight: 600 }}>
                      {c.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {c.roomName ?? (
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        No room
                      </Box>
                    )}
                    {c.roomName && (
                      <Typography variant="body2" color="text.secondary">
                        {areaOf(c)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusChip kind="camera" status={c.status} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{lastSeenLabel(c)}</TableCell>
                  <TableCell>{c.detectionEnabled ? 'On' : 'Off'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
