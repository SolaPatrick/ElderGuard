import { useState } from 'react';
import { Box, Button, Chip, Drawer, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { INCIDENT_STATUS_LABEL, incidentStatusSchema, incidentTypeSchema } from '@elderguard/shared';
import {
  CLASSIFICATION_LABEL,
  NO_FILTERS,
  TYPE_LABEL,
  type Classification,
  type IncidentFilters,
  type pickerOptions,
} from './incidentFilters';

type Options = ReturnType<typeof pickerOptions>;

const toggle = <T,>(items: T[], value: T) =>
  items.includes(value) ? items.filter((x) => x !== value) : [...items, value];

function ChoiceChips<T extends string>({
  label,
  options,
  selected,
  labels,
  onToggle,
}: {
  label: string;
  options: readonly T[];
  selected: readonly T[];
  labels: Record<T, string>;
  onToggle: (value: T) => void;
}) {
  return (
    <Box role="group" aria-label={label}>
      <Typography variant="subtitle2" component="div" sx={{ mb: 2 }}>
        {label}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <Chip
              key={o}
              label={labels[o]}
              icon={on ? <CheckOutlined /> : undefined}
              color={on ? 'primary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              aria-pressed={on}
              onClick={() => onToggle(o)}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

/**
 * INC-02 Advanced filter drawer. Changes stay in the drawer until "Apply filters";
 * the search box and the date preset on the page are kept.
 */
export function IncidentFilterDrawer({
  open,
  filters,
  options,
  onApply,
  onClose,
}: {
  open: boolean;
  filters: IncidentFilters;
  options: Options;
  onApply: (filters: IncidentFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [shownFor, setShownFor] = useState(filters);
  // Start from the page's filters each time they change (e.g. a chip removed on the page).
  if (shownFor !== filters) {
    setShownFor(filters);
    setDraft(filters);
  }
  const set = (patch: Partial<IncidentFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const badRange = draft.date === 'custom' && draft.from !== '' && draft.to !== '' && draft.from > draft.to;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: '100%', sm: 400 } }, role: 'dialog', 'aria-label': 'Filters' },
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: 5, pt: 4, pb: 2 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
          Filters
        </Typography>
        <IconButton aria-label="Close filters" onClick={onClose}>
          <CloseOutlined />
        </IconButton>
      </Stack>
      <Stack spacing={5} sx={{ px: 5, pb: 5, overflowY: 'auto', flex: 1 }}>
        <TextField
          select
          label="Resident"
          value={draft.residentId}
          onChange={(e) => set({ residentId: e.target.value })}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All residents</MenuItem>
          {options.residents.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Room / area"
          value={draft.roomId}
          onChange={(e) => set({ roomId: e.target.value })}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">All rooms and areas</MenuItem>
          {options.rooms.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name}
            </MenuItem>
          ))}
        </TextField>
        <Box role="group" aria-label="Date range">
          <Typography variant="subtitle2" component="div" sx={{ mb: 2 }}>
            Date range
          </Typography>
          <Stack direction="row" spacing={3}>
            <TextField
              label="From"
              type="date"
              fullWidth
              value={draft.date === 'custom' ? draft.from : ''}
              onChange={(e) => set({ date: 'custom', from: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="To"
              type="date"
              fullWidth
              value={draft.date === 'custom' ? draft.to : ''}
              onChange={(e) => set({ date: 'custom', to: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              error={badRange}
              helperText={badRange ? 'Pick a day on or after the start' : undefined}
            />
          </Stack>
        </Box>
        <ChoiceChips
          label="Status"
          options={incidentStatusSchema.options}
          selected={draft.statuses}
          labels={INCIDENT_STATUS_LABEL}
          onToggle={(s) => set({ statuses: toggle(draft.statuses, s) })}
        />
        <ChoiceChips
          label="Type"
          options={incidentTypeSchema.options}
          selected={draft.types}
          labels={TYPE_LABEL}
          onToggle={(t) => set({ types: toggle(draft.types, t) })}
        />
        <TextField
          select
          label="Handled by"
          value={draft.handledById}
          onChange={(e) => set({ handledById: e.target.value })}
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">Anyone</MenuItem>
          {options.staff.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <ChoiceChips<Classification>
          label="Classification"
          options={['confirmed', 'false_alarm']}
          selected={draft.classification ? [draft.classification] : []}
          labels={CLASSIFICATION_LABEL}
          onToggle={(c) => set({ classification: draft.classification === c ? '' : c })}
        />
      </Stack>
      <Stack direction="row" spacing={3} sx={{ px: 5, py: 4, borderTop: 1, borderColor: 'divider' }}>
        <Button
          sx={{ flex: 1 }}
          variant="outlined"
          onClick={() =>
            setDraft({
              ...NO_FILTERS,
              search: draft.search,
              date: draft.date === 'custom' ? NO_FILTERS.date : draft.date,
            })
          }
        >
          Clear all
        </Button>
        <Button
          sx={{ flex: 1 }}
          variant="contained"
          disabled={badRange}
          onClick={() => {
            // An empty custom range means no date limit.
            const d =
              draft.date === 'custom' && !draft.from && !draft.to
                ? { ...draft, date: 'all' as const }
                : draft;
            onApply(d);
          }}
        >
          Apply filters
        </Button>
      </Stack>
    </Drawer>
  );
}
