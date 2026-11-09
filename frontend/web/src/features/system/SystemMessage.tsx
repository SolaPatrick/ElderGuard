import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';
import type { ReactNode } from 'react';

export function SystemMessage({
  code,
  title,
  body,
  action,
}: {
  code?: string;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ py: 12, textAlign: 'center', maxWidth: 520, mx: 'auto' }}>
      {code && (
        <Typography variant="h2" component="p" color="primary" sx={{ fontWeight: 600 }}>
          {code}
        </Typography>
      )}
      <Typography variant="h4" component="h1" sx={{ mt: 2 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 2, mb: 6 }}>
        {body}
      </Typography>
      {action ?? (
        <Button variant="contained" component={RouterLink} to="/">
          Back to dashboard
        </Button>
      )}
    </Box>
  );
}
