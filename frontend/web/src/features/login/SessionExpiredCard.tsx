import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import LockClock from '@mui/icons-material/LockClock';
import { BrandMark } from '../../components/BrandMark';

/** AUTH-09: the server no longer accepts the login. */
export function SessionExpiredCard({ onLogIn }: { onLogIn: () => void }) {
  return (
    <Box
      sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 4, bgcolor: 'background.default' }}
    >
      <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 4 }}>
        <CardContent sx={{ p: 6 }}>
          <Stack direction="row" spacing={3} sx={{ alignItems: 'center', mb: 6 }}>
            <BrandMark tonal />
            <Box>
              <Typography variant="h6" component="div">
                ElderGuard
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Demo Home for the Aged
              </Typography>
            </Box>
          </Stack>
          <LockClock color="primary" sx={{ fontSize: 48, mb: 3 }} aria-hidden />
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, mb: 2 }}>
            Your session has expired
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 6 }}>
            You were logged out because your login ended. A login lasts a set time, and also ends when your
            password is changed or reset. This screen does not receive alerts until you log in again.
          </Typography>
          <Button variant="contained" size="large" fullWidth onClick={onLogIn} autoFocus>
            Log in again
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
