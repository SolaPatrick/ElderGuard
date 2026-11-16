import { useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import Sos from '@mui/icons-material/Sos';
import VideocamOffOutlined from '@mui/icons-material/VideocamOffOutlined';
import { useNavigate } from 'react-router';
import { formatTime, type NotificationKind } from '@elderguard/shared';
import { useNotifications } from '../features/notifications/useNotifications';

const ICON: Record<NotificationKind, typeof Sos> = {
  fall: PersonOutlined,
  sos: Sos,
  camera: VideocamOffOutlined,
};
const SHOWN = 6;

/** SH-03: the bell in the top bar opens the latest notifications. */
export function NotificationBell() {
  const navigate = useNavigate();
  const n = useNotifications();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const viewAll = useRef<HTMLButtonElement>(null);
  const latest = n.items.slice(0, SHOWN);
  const close = () => setAnchor(null);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          aria-label={`Notifications, ${n.unreadCount} unread`}
          aria-haspopup="dialog"
          aria-expanded={anchor ? 'true' : undefined}
        >
          <Badge badgeContent={n.unreadCount} color="error" max={99}>
            <NotificationsOutlined />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': 'Notifications',
            sx: { width: 420, maxWidth: 'calc(100vw - 32px)' },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', px: 5, pt: 4, pb: 2 }}
        >
          <Box>
            <Typography variant="h6" component="h2">
              Notifications
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {n.unreadCount === 0 ? 'All read' : `${n.unreadCount} unread`}
            </Typography>
          </Box>
          <Button
            size="small"
            disabled={n.unreadCount === 0}
            onClick={() => {
              n.markAllRead();
              // The button turns disabled and would drop the focus out of the panel, so
              // Escape would stop closing it. Keep the focus inside.
              viewAll.current?.focus();
            }}
          >
            Mark all as read
          </Button>
        </Stack>
        <Divider />
        {n.isPending ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 5 }}>
            Loading…
          </Typography>
        ) : latest.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 5 }}>
            No notifications yet.
          </Typography>
        ) : (
          <List disablePadding aria-label="Latest notifications">
            {latest.map((item) => {
              const Icon = ICON[item.kind];
              const unread = n.unread(item);
              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => {
                    if (unread) n.setRead(item, true);
                    close();
                    void navigate(item.to);
                  }}
                  sx={{
                    px: 5,
                    py: 2.5,
                    gap: 3,
                    alignItems: 'flex-start',
                    bgcolor: unread ? 'action.hover' : undefined,
                  }}
                  aria-label={`${unread ? 'Unread: ' : ''}${item.title}`}
                >
                  <ListItemIcon sx={{ minWidth: 0, mt: 0.5 }}>
                    <Icon color={item.kind === 'camera' ? 'action' : 'error'} aria-hidden />
                  </ListItemIcon>
                  <ListItemText
                    sx={{ m: 0 }}
                    primary={item.title}
                    secondary={item.detail}
                    slotProps={{ primary: { variant: 'body2', sx: { fontWeight: unread ? 600 : 400 } } }}
                  />
                  {item.at && (
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mt: 0.5 }}>
                      {formatTime(item.at)}
                    </Typography>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        )}
        <Divider />
        <Button
          ref={viewAll}
          fullWidth
          sx={{ py: 3, borderRadius: 0 }}
          onClick={() => {
            close();
            void navigate('/notifications');
          }}
        >
          View all notifications
        </Button>
      </Popover>
    </>
  );
}
