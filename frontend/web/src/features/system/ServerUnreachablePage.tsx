import { useEffect } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import Construction from '@mui/icons-material/Construction';
import WifiOff from '@mui/icons-material/WifiOff';
import { useAuth } from '../../auth/authContext';
import { SystemMessage } from './SystemMessage';

const RETRY_MS = 10_000;

/**
 * SYS-04: the saved login could not be checked because the server did not answer.
 * SYS-05: the server answered 503, which means it is down for maintenance.
 * The user stays logged in, and the page tries again by itself so an unattended
 * monitoring screen comes back when the server does.
 */
export function ServerUnreachablePage({ message, maintenance }: { message: string; maintenance: boolean }) {
  const { retry, logout } = useAuth();
  useEffect(() => {
    const id = window.setInterval(retry, RETRY_MS);
    return () => window.clearInterval(id);
  }, [retry]);

  if (maintenance) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          p: 4,
          bgcolor: 'background.default',
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 520, borderRadius: 4 }}>
          <CardContent sx={{ p: { xs: 5, sm: 8 }, textAlign: 'center' }}>
            <Construction color="primary" sx={{ fontSize: 48, mb: 3 }} aria-hidden />
            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 2 }}>
              Scheduled maintenance
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 5 }}>
              ElderGuard is being updated and will be back shortly. You are still logged in, and this page
              checks again every 10 seconds.
            </Typography>
            <Alert severity="warning" sx={{ textAlign: 'left', mb: 5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Monitoring is unavailable during maintenance.
              </Typography>
              No fall alerts reach this screen. Do in-person rounds until ElderGuard is back.
            </Alert>
            <Stack spacing={2}>
              <Button variant="contained" size="large" onClick={retry}>
                Check again
              </Button>
              <Button onClick={() => void logout()}>Log out</Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 4, bgcolor: 'background.default' }}
    >
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <WifiOff sx={{ fontSize: 48 }} color="error" aria-hidden />
        </Box>
        <SystemMessage
          title="Can't reach ElderGuard"
          body={`${message} Alerts cannot be received until the connection is back. You are still logged in, and this page tries again every 10 seconds.`}
          action={
            <Stack direction="row" spacing={3} sx={{ justifyContent: 'center' }}>
              <Button variant="contained" onClick={retry}>
                Retry
              </Button>
              <Button onClick={() => void logout()}>Log out</Button>
            </Stack>
          }
        />
      </Box>
    </Box>
  );
}
