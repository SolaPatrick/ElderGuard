import { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Resident, RoomRef, StaffMember } from '@elderguard/shared';
import { useAssignStaff, useResidents, useRooms } from '../../api/queries';
import { errorMessage } from '../../components/errorMessage';
import { useToast } from '../../components/toastContext';

const roomLabel = (r: RoomRef) => (r.wing ? `${r.name} · ${r.wing}` : r.name);
const residentLabel = (r: Resident) => (r.room ? `${r.fullName} · ${r.room.name}` : r.fullName);

/**
 * USR-10: choose the rooms an employee monitors and the residents they are a named caregiver for.
 * Rooms decide what the employee sees, so residents outside them get a warning.
 */
export function AssignDialog({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const rooms = useRooms();
  const residents = useResidents();
  const assign = useAssignStaff(staff.id);
  const toast = useToast();
  const [areaIds, setAreaIds] = useState(() => staff.areas.map((a) => a.id));
  const [residentIds, setResidentIds] = useState(() => staff.residents.map((r) => r.id));

  const roomOptions = rooms.data ?? [];
  const residentOptions = residents.data ?? [];
  const chosenRooms = roomOptions.filter((r) => areaIds.includes(r.id));
  const chosenResidents = residentOptions.filter((r) => residentIds.includes(r.id));
  const outside = chosenResidents.filter((r) => !r.room || !areaIds.includes(r.room.id));
  const loadError = rooms.error ?? residents.error;

  const save = () =>
    assign.mutate(
      { areaIds, residentIds },
      {
        onSuccess: () => {
          toast({ message: `Assignments saved for ${staff.fullName}` });
          onClose();
        },
      },
    );

  return (
    <Dialog open onClose={() => !assign.isPending && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>Assign residents and areas</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
          {staff.fullName} gets alerts and sees cameras, residents and incidents only in the rooms and areas
          you choose here.
        </Typography>
        {loadError ? (
          <Alert severity="error" role="alert">
            {errorMessage(loadError)}
          </Alert>
        ) : (
          <Stack spacing={5}>
            {assign.error && (
              <Alert severity="error" role="alert">
                {errorMessage(assign.error)}
              </Alert>
            )}
            <Autocomplete
              multiple
              disableCloseOnSelect
              loading={rooms.isPending}
              options={roomOptions}
              value={chosenRooms}
              onChange={(_, value) => setAreaIds(value.map((r) => r.id))}
              getOptionLabel={roomLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderValue={(value, getItemProps) =>
                value.map((r, index) => {
                  const { key, ...props } = getItemProps({ index });
                  return <Chip key={key} variant="outlined" label={roomLabel(r)} {...props} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Rooms and areas"
                  helperText={
                    areaIds.length === 0 ? "With no rooms, this employee won't get any alerts." : ' '
                  }
                />
              )}
            />
            <Autocomplete
              multiple
              disableCloseOnSelect
              loading={residents.isPending}
              options={residentOptions}
              value={chosenResidents}
              onChange={(_, value) => setResidentIds(value.map((r) => r.id))}
              getOptionLabel={residentLabel}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderValue={(value, getItemProps) =>
                value.map((r, index) => {
                  const { key, ...props } = getItemProps({ index });
                  return <Chip key={key} variant="outlined" label={r.fullName} {...props} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Residents"
                  helperText="They are listed as this employee's caregiver on the resident's profile."
                />
              )}
            />
            {outside.length > 0 && (
              <Alert severity="warning">
                {outside.map((r) => r.fullName).join(', ')} {outside.length === 1 ? 'lives' : 'live'} outside
                the chosen rooms, so {staff.fullName} won't see {outside.length === 1 ? 'their' : 'those'}{' '}
                alerts. Add the room too.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={assign.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          loading={assign.isPending}
          disabled={Boolean(loadError) || rooms.isPending || residents.isPending}
          onClick={save}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
