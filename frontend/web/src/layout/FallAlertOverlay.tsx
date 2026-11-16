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
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
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
import { useToast } from '../components/toastContext';

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
 *
 * When several alerts wait, they share one popup ("Alert 1 of 3" with
 * previous / next), and one close hides all of them at once. An alert that
 * arrives after that opens the popup again.
 */
export function FallAlertOverlay({ incidents }: { incidents: Incident[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const now = useNow();
  const acknowledge = useAcknowledge();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
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
  const index = Math.max(
    0,
    pending.findIndex((i) => i.code === selected),
  );
  const current = pending.at(index);
  useAlarm(current !== undefined);

  if (!current) return null;

  const show = (next: number) => {
    acknowledge.reset();
    setSelected(pending.at(next)?.code ?? null);
  };
  const hide = (codes: string[]) => {
    acknowledge.reset();
    setDismissed((prev) => new Set([...prev, ...codes]));
  };
  /** Hides every alert waiting in the popup on this computer. */
  const closeAll = () => hide(pending.map((i) => i.code));
  const goToDetail = () => {
    hide([current.code]);
    void navigate(`/alerts/${current.code}`);
  };
  const goToQueue = () => {
    closeAll();
    void navigate('/alerts');
  };
  const many = pending.length > 1;
  const onAcknowledge = () =>
    acknowledge.mutate(current.code, {
      onSuccess: (updated) => {
        toast({ message: `Acknowledged · ${updated.code}` });
        goToDetail();
      },
    });

  const isSos = current.type === 'sos';
  const titleId = `alert-title-${current.code}`;

  return (
    <Dialog
      open
      onClose={(_e, reason) => {
        // Clicking outside must not hide an emergency by accident.
        if (reason !== 'backdropClick') closeAll();
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
          </Typography>
        </Box>
        {many && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mr: 2 }}>
            <IconButton onClick={() => show(index - 1)} disabled={index === 0} aria-label="Previous alert">
              <ChevronLeft />
            </IconButton>
            <Typography variant="body2" sx={{ fontWeight: 600 }} aria-live="polite">
              Alert {index + 1} of {pending.length}
            </Typography>
            <IconButton
              onClick={() => show(index + 1)}
              disabled={index === pending.length - 1}
              aria-label="Next alert"
            >
              <ChevronRight />
            </IconButton>
          </Stack>
        )}
        <IconButton
          onClick={closeAll}
          aria-label="Close alert popup"
          title={many ? `Close all ${pending.length} alerts` : 'Close'}
        >
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
        {many && (
          <Button onClick={goToQueue} sx={{ mr: 'auto' }}>
            See all {pending.length} alerts
          </Button>
        )}
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
