import { useState } from 'react';
import {
  Box,
  InputAdornment,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { useActiveIncidents, useCameras } from '../../api/queries';
import { CameraTile } from '../../components/CameraTile';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, LoadingBlock } from '../../components/QueryStates';
import {
  COLUMNS,
  alertForCamera,
  LAYOUTS,
  areaOptions,
  filterCameras,
  loadLayout,
  saveLayout,
  type Layout,
} from './cameraFilters';

/** MON-01 Live Monitoring grid. */
export function MonitoringPage() {
  const cameras = useCameras();
  const active = useActiveIncidents();
  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [area, setArea] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const all = cameras.data ?? [];
  const online = all.filter((c) => c.status === 'online').length;
  const shown = filterCameras(all, area, search);
  const pageCount = Math.max(1, Math.ceil(shown.length / layout));
  const current = Math.min(page, pageCount);
  const visible = shown.slice((current - 1) * layout, current * layout);
  const alerts = active.data ?? [];

  return (
    <>
      <PageHeader
        title="Live Monitoring"
        subtitle={cameras.data ? `${all.length} cameras · ${online} online` : undefined}
      />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mb: 5, alignItems: { md: 'center' } }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={layout}
          aria-label="Cameras per page"
          onChange={(_, value: Layout | null) => {
            if (value === null) return;
            setLayout(value);
            saveLayout(value);
            setPage(1);
          }}
        >
          {LAYOUTS.map((n) => (
            <ToggleButton key={n} value={n} aria-label={`${n} per page`} sx={{ px: 4 }}>
              {n}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          select
          size="small"
          label="Area"
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setPage(1);
          }}
          sx={{ width: { xs: '100%', md: 200 }, flexShrink: 0 }}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All areas</MenuItem>
          {areaOptions(all).map((a) => (
            <MenuItem key={a} value={a}>
              {a}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          placeholder="Search cameras"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}
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
      </Stack>

      {cameras.isPending ? (
        <LoadingBlock label="Loading cameras" />
      ) : cameras.isError ? (
        <ErrorState error={cameras.error} onRetry={() => void cameras.refetch()} />
      ) : shown.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 10, textAlign: 'center' }}>
          {all.length === 0 ? 'No cameras are assigned to you yet.' : 'No cameras match your search.'}
        </Typography>
      ) : (
        <>
          <Box
            component="ul"
            aria-label="Cameras"
            sx={{
              listStyle: 'none',
              p: 0,
              m: 0,
              display: 'grid',
              gap: 4,
              gridTemplateColumns: {
                xs: '1fr',
                sm: `repeat(${Math.min(COLUMNS[layout], 2)}, 1fr)`,
                lg: `repeat(${COLUMNS[layout]}, 1fr)`,
              },
            }}
          >
            {visible.map((c) => (
              <li key={c.id}>
                <CameraTile
                  camera={c}
                  alert={alertForCamera(c, alerts)}
                  to={`/monitoring/${c.code}`}
                  height={layout === 1 ? 480 : layout === 4 ? 280 : layout === 9 ? 200 : 150}
                  showDetection
                />
              </li>
            ))}
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{ mt: 5, justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Typography variant="body2" color="text.secondary">
              Showing {visible.length} of {shown.length} cameras
            </Typography>
            {pageCount > 1 && (
              <Pagination count={pageCount} page={current} onChange={(_, p) => setPage(p)} shape="rounded" />
            )}
          </Stack>
        </>
      )}
    </>
  );
}
