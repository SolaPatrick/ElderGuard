import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import { useLocation, useNavigate } from 'react-router';
import {
  FALL_RISK_LABEL,
  formatDate,
  formatElapsed,
  formatTime,
  formatTimeWithSeconds,
  incidentPersonName,
  incidentTitle,
  secondsBetween,
  type Incident,
} from '@elderguard/shared';
import { useCurrentUser } from '../auth/authContext';
import { useAcknowledge } from '../api/queries';
import { CameraSnapshot } from '../components/CameraSnapshot';
import { errorMessage } from '../components/errorMessage';
import { useAlarm } from '../hooks/useAlarm';
import { useNow } from '../hooks/useNow';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  );
}

/**
 * SH-05 / SH-06: takes over the screen when a new alert arrives, with a
 * repeating alarm, until someone acknowledges it or closes the popup.
 * Closing only hides it on this computer; the red banner stays until it is handled.
 */
export function FallAlertOverlay({ incidents }: { incidents: Incident[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow();
  const acknowledge = useAcknowledge();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const userId = useCurrentUser().id;

  const pending = useMemo(
    () =>
      incidents
        .filter((i) => i.status === 'new' && !dismissed.has(i.code))
        // The sender of an SOS already knows about it.
        .filter((i) => i.sentBy?.id !== userId)
        // Do not cover the page of the alert the user is already looking at.
        .filter((i) => !location.pathname.endsWith(`/${i.code}`))
        .toSorted((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt)),
    [incidents, dismissed, location.pathname, userId],
  );
  const current = pending[0];
  useAlarm(current !== undefined);

  if (!current) return null;

  const dismiss = () => {
    acknowledge.reset();
    setDismissed((prev) => new Set(prev).add(current.code));
  };
  const goToDetail = () => {
    dismiss();
    void navigate(`/alerts/${current.code}`);
  };
  const onAcknowledge = () =>
    acknowledge.mutate(current.code, {
      onSuccess: () => goToDetail(),
    });

  const isSos = current.type === 'sos';
  const titleId = `alert-title-${current.code}`;

  return (
    <Dialog
      open
      onClose={(_e, reason) => {
        // Clicking outside must not hide an emergency by accident.
        if (reason !== 'backdropClick') dismiss();
      }}
      maxWidth="md"
      fullWidth
      aria-labelledby={titleId}
      slotProps={{ paper: { role: 'alertdialog' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', px: 6, pt: 5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography id={titleId} variant="h5" component="h2" sx={{ fontWeight: 600 }}>
            {incidentTitle(current)}
            {isSos && ` · ${current.room.name}`}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Alarm sounding · repeats until someone acknowledges
            {pending.length > 1 && ` · +${pending.length - 1} more waiting`}
          </Typography>
        </Box>
        <IconButton onClick={dismiss} aria-label="Close alert popup">
          <Close />
        </IconButton>
      </Box>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={5}>
          <Box sx={{ flex: 1.2 }}>
            <CameraSnapshot
              src={current.snapshotUrl}
              alerting
              timeLabel={formatTimeWithSeconds(current.detectedAt)}
              caption={
                current.camera ? `Camera snapshot · ${current.camera.code}` : 'No camera for this alert'
              }
            />
          </Box>
          <Stack spacing={3} sx={{ flex: 1 }}>
            {isSos ? (
              <Field label="Sent by" value={incidentPersonName(current)} />
            ) : (
              <Field
                label="Resident"
                value={
                  current.resident
                    ? [
                        current.resident.fullName,
                        current.resident.age,
                        FALL_RISK_LABEL[current.resident.fallRisk],
                      ]
                        .filter((x) => x !== null)
                        .join(' · ')
                    : 'Unknown resident'
                }
              />
            )}
            <Field
              label="Room / area"
              value={[current.room.name, current.room.wing].filter(Boolean).join(' · ')}
            />
            {current.camera && (
              <Field label="Camera" value={`${current.camera.code} · ${current.room.name}`} />
            )}
            <Field
              label="Detected"
              value={`${formatTime(current.detectedAt)} · ${formatDate(current.detectedAt)}`}
            />
            <Box
              sx={{
                p: 4,
                borderRadius: 2,
                border: 1,
                borderColor: 'divider',
                bgcolor: 'eg.sys.surfaceContainerLow',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Elapsed
              </Typography>
              <Typography variant="h3" component="p" sx={{ fontWeight: 400 }} aria-live="off">
                {formatElapsed(secondsBetween(current.detectedAt, now))}
              </Typography>
            </Box>
          </Stack>
        </Stack>
        {acknowledge.isError && (
          <Alert severity="warning" sx={{ mt: 4 }}>
            {errorMessage(acknowledge.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5, flexWrap: 'wrap', gap: 2 }}>
        <Button variant="outlined" onClick={goToDetail}>
          View details
        </Button>
        <Button
          variant="contained"
          onClick={onAcknowledge}
          loading={acknowledge.isPending}
          sx={{ minHeight: 48 }}
        >
          Acknowledge
        </Button>
      </DialogActions>
    </Dialog>
  );
}
