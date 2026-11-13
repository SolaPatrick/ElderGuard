import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import Sos from '@mui/icons-material/Sos';
import VideocamOffOutlined from '@mui/icons-material/VideocamOffOutlined';
import { Link as RouterLink } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { ErrorState, SkeletonRows } from '../../components/QueryStates';
import type { NotificationItem, NotificationKind } from './notificationItems';
import { useNotifications } from './useNotifications';

type Tab = 'all' | 'unread' | NotificationKind;
const KIND_TABS: { id: NotificationKind; label: string }[] = [
  { id: 'fall', label: 'Fall' },
  { id: 'sos', label: 'SOS' },
  { id: 'camera', label: 'Camera offline' },
];
const STEP = 30;

const ICON: Record<NotificationKind, typeof Sos> = {
  fall: PersonOutlined,
  sos: Sos,
  camera: VideocamOffOutlined,
};

/** NTF-01 Notification center (Admin/Head and caregivers). */
export function NotificationsPage() {
  const n = useNotifications();
  const [tab, setTab] = useState<Tab>('all');
  const [limit, setLimit] = useState(STEP);

  const all = n.items;
  const unreadCount = n.unreadCount;
  const shown = all.filter((item) =>
    tab === 'all' ? true : tab === 'unread' ? n.unread(item) : item.kind === tab,
  );
  const page = shown.slice(0, limit);
  const pending = n.isPending;
  const failed = n.failed;

  const tabChip = (id: Tab, label: string) => (
    <Chip
      key={id}
      label={label}
      color={tab === id ? 'primary' : 'default'}
      variant={tab === id ? 'filled' : 'outlined'}
      aria-pressed={tab === id}
      onClick={() => {
        setTab(id);
        setLimit(STEP);
      }}
    />
  );

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Falls, SOS requests and camera problems you can see."
        actions={
          <Button variant="outlined" disabled={unreadCount === 0} onClick={n.markAllRead}>
            Mark all as read
          </Button>
        }
      />
      <Stack direction="row" role="group" aria-label="Show" sx={{ flexWrap: 'wrap', gap: 2, mb: 4 }}>
        {tabChip('all', 'All')}
        {tabChip('unread', `Unread (${unreadCount})`)}
        {KIND_TABS.map((t) => tabChip(t.id, t.label))}
      </Stack>

      {pending ? (
        <SkeletonRows rows={5} />
      ) : failed ? (
        <ErrorState error={failed.error} onRetry={() => void failed.refetch()} />
      ) : page.length === 0 ? (
        <Card sx={{ p: 8, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {tab === 'unread' ? "You're all caught up." : 'No notifications here.'}
          </Typography>
        </Card>
      ) : (
        <Card>
          <List disablePadding aria-label="Notifications">
            {page.map((item, index) => (
              <Row
                key={item.id}
                item={item}
                unread={n.unread(item)}
                divider={index < page.length - 1}
                onToggle={(read) => n.setRead(item, read)}
              />
            ))}
          </List>
        </Card>
      )}
      {shown.length > limit && (
        <Box sx={{ textAlign: 'center', mt: 4 }}>
          <Button onClick={() => setLimit((l) => l + STEP)}>Show older</Button>
        </Box>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
        Read and unread are remembered on this device.
      </Typography>
    </>
  );
}

function Row({
  item,
  unread,
  divider,
  onToggle,
}: {
  item: NotificationItem;
  unread: boolean;
  divider: boolean;
  onToggle: (read: boolean) => void;
}) {
  const Icon = ICON[item.kind];
  return (
    <ListItem
      divider={divider}
      sx={{
        py: 3,
        px: 5,
        bgcolor: unread ? 'action.hover' : undefined,
        gap: 3,
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
      }}
      aria-label={`${unread ? 'Unread: ' : ''}${item.title}`}
    >
      <ListItemIcon sx={{ minWidth: 0 }}>
        <Icon color={item.kind === 'camera' ? 'action' : 'error'} aria-hidden />
      </ListItemIcon>
      <ListItemText
        sx={{ flex: 1, minWidth: 0 }}
        primary={
          <Link
            component={RouterLink}
            to={item.to}
            color="inherit"
            underline="hover"
            sx={{ fontWeight: unread ? 600 : 400 }}
            onClick={() => onToggle(true)}
          >
            {item.title}
          </Link>
        }
        secondary={item.detail}
      />
      <Button size="small" onClick={() => onToggle(unread)} sx={{ flexShrink: 0 }}>
        {unread ? 'Mark as read' : 'Mark as unread'}
      </Button>
    </ListItem>
  );
}
