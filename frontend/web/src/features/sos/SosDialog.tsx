import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Sos from '@mui/icons-material/Sos';
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import { useNavigate } from 'react-router';
import { formatTime, type IncidentDetail } from '@elderguard/shared';
import { SOS_HOLD_MS } from '../../api/config';
import { useResidents, useRooms, useSendSos } from '../../api/queries';
import { useCurrentUser } from '../../auth/authContext';
import { HoldToConfirmButton } from '../../components/HoldToConfirmButton';
import { errorMessage } from '../../components/errorMessage';

/** How long the "SOS sent" confirmation stays before opening the SOS. */
const SENT_PAUSE_MS = 1500;

const roomLabel = (r: { name: string; wing: string | null }) => (r.wing ? `${r.name} · ${r.wing}` : r.name);

/** The form. Mounted fresh each time the dialog opens, so it always starts empty. */
function SosForm({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const rooms = useRooms();
  const residents = useResidents();
  const send = useSendSos();
  const [chosenRoom, setChosenRoom] = useState<string | null>(null);
  const [residentId, setResidentId] = useState('');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<IncidentDetail | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Caregivers start on their first assigned area; the Admin/Head picks one.
  const roomId = chosenRoom ?? user.areas[0]?.id ?? '';
  const roomList = rooms.data ?? [];
  const residentList = (residents.data ?? []).toSorted(
    (a, b) => Number(b.room?.id === roomId) - Number(a.room?.id === roomId),
  );

  useEffect(() => {
    if (!sent) return;
    const id = window.setTimeout(() => {
      closeRef.current();
      navigate(`/alerts/${sent.code}`);
    }, SENT_PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [sent, navigate]);

  const submit = () => {
    if (!roomId || send.isPending) return;
    send.mutate(
      { roomId, ...(residentId && { residentId }), ...(note.trim() && { note: note.trim() }) },
      { onSuccess: setSent },
    );
  };

  if (sent) {
    return (
      <DialogContent sx={{ textAlign: 'center', py: 8 }}>
        <CheckCircleOutlined sx={{ fontSize: 56, color: 'eg.sys.success' }} aria-hidden />
        <Typography variant="h5" component="h2" sx={{ mt: 3 }} role="status">
          SOS sent
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          All on-duty staff have been alerted.
        </Typography>
        <Typography variant="body2" sx={{ mt: 4 }}>
          Sent at {formatTime(sent.detectedAt)} · {sent.room.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Opening SOS status…
        </Typography>
      </DialogContent>
    );
  }

  return (
    <>
      <DialogTitle sx={{ pr: 12 }}>
        Send SOS
        <Typography variant="body2" color="text.secondary">
          Alerts every on-duty staff member immediately.
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="Close"
          sx={{ position: 'absolute', right: 12, top: 12 }}
          disabled={send.isPending}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={4} sx={{ pt: 2 }}>
          {rooms.isError && <Alert severity="error">{errorMessage(rooms.error)}</Alert>}
          <TextField
            select
            required
            label="Location"
            value={roomList.some((r) => r.id === roomId) ? roomId : ''}
            onChange={(e) => setChosenRoom(e.target.value)}
            helperText={
              user.areas.length > 0
                ? 'Prefilled from your assigned area. You can change it.'
                : 'Where do you need help?'
            }
            disabled={rooms.isPending}
          >
            {roomList.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {roomLabel(r)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Resident (optional)"
            value={residentId}
            onChange={(e) => setResidentId(e.target.value)}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          >
            <MenuItem value="">No specific resident</MenuItem>
            {residentList.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.fullName}
                {r.room ? ` · ${r.room.name}` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            placeholder="For example: Need help lifting a resident."
          />
          {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}
          <Box>
            <HoldToConfirmButton
              holdMs={SOS_HOLD_MS}
              onConfirm={submit}
              disabled={!roomId || send.isPending}
              icon={<Sos />}
              label={send.isPending ? 'Sending SOS…' : 'Press and hold to send SOS'}
              hint="Hold for 3 seconds to prevent accidental alerts."
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button onClick={onClose} disabled={send.isPending}>
          Cancel
        </Button>
      </DialogActions>
    </>
  );
}

/** SOS-01 Send SOS. */
export function SosDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && <SosForm onClose={onClose} />}
    </Dialog>
  );
}
