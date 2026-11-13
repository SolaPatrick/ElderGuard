import { useEffect } from 'react';
import { Box, Button, Stack } from '@mui/material';
import WifiOff from '@mui/icons-material/WifiOff';
import { useAuth } from '../../auth/authContext';
import { SystemMessage } from './SystemMessage';

const RETRY_MS = 10_000;

/**
 * SYS-04: the saved login could not be checked because the server did not answer.
 * The user stays logged in, and the page tries again by itself so an unattended
 * monitoring screen comes back when the server does.
 */
export function ServerUnreachablePage({ message }: { message: string }) {
  const { retry, logout } = useAuth();
  useEffect(() => {
    const id = window.setInterval(retry, RETRY_MS);
    return () => window.clearInterval(id);
  }, [retry]);

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
