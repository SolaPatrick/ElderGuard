import { Alert, Box, Button, CircularProgress, Skeleton, Stack } from '@mui/material';
import { errorMessage } from './errorMessage';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      variant="outlined"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      {errorMessage(error)}
    </Alert>
  );
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
      <CircularProgress aria-label={label} />
    </Box>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <Stack spacing={2} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={48} />
      ))}
    </Stack>
  );
}
