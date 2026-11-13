import { useId, useState } from 'react';
import { Alert, Box, Button, Chip, Slider, Stack, Typography } from '@mui/material';
import Block from '@mui/icons-material/Block';
import CheckCircle from '@mui/icons-material/CheckCircle';
import HelpOutlined from '@mui/icons-material/HelpOutlined';
import WifiTethering from '@mui/icons-material/WifiTethering';
import { playTestAlarm } from '../../hooks/useAlarm';
import { setAlarmVolume, useAlarmVolume } from './alertPrefs';
import { requestNotificationAccess, type NotificationAccess } from './desktopNotifications';

const ACCESS_CHIP: Record<
  NotificationAccess,
  { label: string; icon: React.ReactElement; color: 'success' | 'default' | 'warning' }
> = {
  granted: { label: 'Allowed', icon: <CheckCircle />, color: 'success' },
  default: { label: 'Not allowed yet', icon: <HelpOutlined />, color: 'default' },
  denied: { label: 'Blocked', icon: <Block />, color: 'warning' },
  unsupported: { label: 'Not available', icon: <Block />, color: 'default' },
};

export function NotificationAccessChip({ access }: { access: NotificationAccess }) {
  const chip = ACCESS_CHIP[access];
  return <Chip size="small" variant="outlined" icon={chip.icon} label={chip.label} color={chip.color} />;
}

/** Explains what to do for each permission state, with the button to ask when the browser still can. */
export function NotificationAccessHelp({ access }: { access: NotificationAccess }) {
  const [asking, setAsking] = useState(false);
  if (access === 'default') {
    return (
      <Button
        variant="contained"
        sx={{ alignSelf: 'flex-start' }}
        loading={asking}
        onClick={() => {
          setAsking(true);
          void requestNotificationAccess().finally(() => setAsking(false));
        }}
      >
        Allow notifications
      </Button>
    );
  }
  if (access === 'denied') {
    return (
      <Alert severity="warning">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          You will not see alerts when this tab is in the background.
        </Typography>
        The browser blocked notifications for ElderGuard, and only you can change that: click the icon left of
        the address bar, set Notifications to Allow, then reload the page.
      </Alert>
    );
  }
  if (access === 'unsupported') {
    return (
      <Typography variant="body2" color="text.secondary">
        This browser or connection cannot show desktop notifications (they need a secure https address). Keep
        the ElderGuard tab open and in front to see alerts.
      </Typography>
    );
  }
  return (
    <Typography variant="body2" color="text.secondary">
      A new alert shows a desktop notification while this tab is in the background.
    </Typography>
  );
}

/** Plays the alarm three times so the user can check the speakers, then asks if they heard it. */
export function TestAlarmButton({ variant = 'outlined' }: { variant?: 'outlined' | 'contained' }) {
  const volume = useAlarmVolume();
  const [result, setResult] = useState<'played' | 'no-sound' | null>(null);
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Button
        variant={variant}
        startIcon={<WifiTethering />}
        onClick={() => setResult(playTestAlarm(volume) ? 'played' : 'no-sound')}
      >
        Play test alarm
      </Button>
      {result === 'played' && (
        <Typography variant="body2" color="text.secondary" role="status">
          {volume === 0
            ? 'The alarm volume is 0%, so nothing played. Turn it up first.'
            : "Didn't hear it? Check the computer's volume and that this tab is not muted, then try again."}
        </Typography>
      )}
      {result === 'no-sound' && (
        <Alert severity="warning">This browser cannot play sound. Alarms will only show on screen.</Alert>
      )}
    </Stack>
  );
}

export function AlarmVolumeSlider() {
  const volume = useAlarmVolume();
  const labelId = useId();
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography id={labelId} variant="body2">
          Volume on this computer
        </Typography>
        <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
          {volume}%
        </Typography>
      </Stack>
      <Slider
        aria-labelledby={labelId}
        value={volume}
        min={0}
        max={100}
        step={10}
        getAriaValueText={(v) => `${v}%`}
        onChange={(_e, v) => setAlarmVolume(v)}
      />
    </Box>
  );
}
