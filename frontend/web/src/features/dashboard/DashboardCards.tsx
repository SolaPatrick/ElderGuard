import type { ReactNode } from 'react';
import { Avatar, Box, Button, Card, CardContent, Divider, Link, Stack, Typography } from '@mui/material';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import Sos from '@mui/icons-material/Sos';
import { Link as RouterLink } from 'react-router';
import {
  formatElapsed,
  incidentPersonName,
  incidentTitle,
  secondsBetween,
  type Incident,
} from '@elderguard/shared';
import { useAcknowledge } from '../../api/queries';
import { useNow } from '../../hooks/useNow';

export function SectionCard({
  title,
  action,
  children,
  urgent = false,
  icon,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  urgent?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        ...(urgent && {
          bgcolor: 'eg.comp.alertWashNew',
          borderColor: 'eg.comp.alertBorderNew',
          borderWidth: 2,
        }),
      }}
    >
      <CardContent sx={{ p: 5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', mb: 4, gap: 2 }}>
          {icon}
          <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export function ActiveAlertsCard({
  incidents,
  title = 'Active alerts',
  showDetailsLink = false,
}: {
  incidents: Incident[];
  title?: string;
  showDetailsLink?: boolean;
}) {
  const now = useNow();
  const acknowledge = useAcknowledge();
  if (incidents.length === 0) {
    return (
      <SectionCard
        title={title}
        action={
          <Link component={RouterLink} to="/alerts">
            View all
          </Link>
        }
      >
        <Typography color="text.secondary">All clear. No open alerts right now.</Typography>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      urgent
      title={title}
      icon={<NotificationsActiveOutlined sx={{ color: 'eg.sys.critical' }} />}
      action={
        <Link component={RouterLink} to="/alerts">
          View all
        </Link>
      }
    >
      <Stack divider={<Divider />} spacing={3}>
        {incidents.map((i) => (
          <Stack key={i.code} direction="row" spacing={3} sx={{ alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'eg.sys.critical', color: 'eg.sys.onCritical' }}>
              {i.type === 'sos' ? <Sos fontSize="small" /> : <PersonOutlined />}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Link
                component={RouterLink}
                to={`/alerts/${i.code}`}
                color="inherit"
                underline="hover"
                variant="subtitle2"
              >
                {incidentTitle(i)} · {i.room.name}
              </Link>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {incidentPersonName(i)}
                {i.camera && ` · ${i.camera.code}`}
                {' · '}
                {i.status === 'new' ? 'New' : `Acknowledged by ${i.acknowledgedBy?.fullName ?? 'staff'}`}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatElapsed(secondsBetween(i.detectedAt, now))}
            </Typography>
            {showDetailsLink && (
              <Button size="small" component={RouterLink} to={`/alerts/${i.code}`}>
                View details
              </Button>
            )}
            {i.status === 'new' && (
              <Button
                size="small"
                variant={showDetailsLink ? 'contained' : 'text'}
                onClick={() => acknowledge.mutate(i.code)}
                loading={acknowledge.isPending && acknowledge.variables === i.code}
              >
                Acknowledge
              </Button>
            )}
          </Stack>
        ))}
      </Stack>
    </SectionCard>
  );
}
