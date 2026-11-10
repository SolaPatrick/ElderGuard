import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      // Clipboard access can be blocked (e.g. plain http). The value stays visible to copy by hand.
      setFailed(true);
    }
  };
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography
          sx={{ fontFamily: 'monospace', fontSize: 18, flex: 1, userSelect: 'all', wordBreak: 'break-all' }}
          aria-label={label}
        >
          {value}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={copied ? <CheckOutlined /> : <ContentCopyOutlined />}
          onClick={() => void copy()}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </Stack>
      {failed && (
        <Typography variant="caption" color="error">
          Could not copy. Select the text and copy it yourself.
        </Typography>
      )}
    </Box>
  );
}

/**
 * USR-03 "User created" and USR-08 "New temporary password". The password exists only
 * in this dialog: once it closes, the only way to get one is another reset.
 */
export function CredentialsDialog({
  title,
  intro,
  username,
  password,
  onClose,
}: {
  title: string;
  intro: string;
  /** Shown for a new account, so the admin can pass on both. */
  username?: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onClose={(_, reason) => reason !== 'backdropClick' && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          {intro}
        </Typography>
        <Stack spacing={4}>
          {username && <CopyRow label="Username" value={username} />}
          <CopyRow label="Temporary password" value={password} />
          <Alert severity="warning" variant="outlined">
            This password is shown only once. They must change it when they first log in.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 6, pb: 5 }}>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
