import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import HelpOutlined from '@mui/icons-material/HelpOutlined';
import { NavLink, useMatch } from 'react-router';
import { numbers, type User } from '@elderguard/shared';
import { BrandMark } from '../components/BrandMark';
import { NAV_ITEMS, type NavItem } from './navigation';
import { APP_VERSION } from '../version';

function NavEntry({
  item,
  label,
  badge,
  onNavigate,
}: {
  item: NavItem;
  label: string;
  badge: number;
  onNavigate?: () => void;
}) {
  const active = useMatch({ path: item.to, end: item.to === '/' }) !== null;
  return (
    <ListItemButton
      component={NavLink}
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      selected={active}
      sx={{
        borderRadius: 999,
        minHeight: numbers.size.targetWeb + 4,
        mb: 1,
        px: 4,
        color: 'text.primary',
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: 'eg.comp.navActiveIndicator', fontWeight: 600 },
      }}
    >
      <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
        <item.icon />
      </ListItemIcon>
      <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: active ? 600 : 400 } } }} />
      {item.alertBadge && badge > 0 && (
        <Box
          component="span"
          aria-label={`${badge} active alerts`}
          sx={{
            minWidth: 22,
            height: 22,
            px: 1.5,
            borderRadius: 999,
            bgcolor: 'eg.sys.critical',
            color: 'eg.sys.onCritical',
            typography: 'caption',
            fontWeight: 600,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {badge}
        </Box>
      )}
    </ListItemButton>
  );
}

export function Sidebar({
  user,
  alertCount,
  onNavigate,
}: {
  user: User;
  alertCount: number;
  onNavigate?: () => void;
}) {
  const items = NAV_ITEMS.filter((i) => i.roles.includes(user.role));
  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        p: 4,
        bgcolor: 'eg.sys.surfaceContainerLow',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, px: 2, mb: 6 }}>
        <BrandMark />
        <Box>
          <Typography variant="h5" component="div" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
            ElderGuard
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user.role === 'admin' ? 'Admin/Head console' : 'Caregiver console'}
          </Typography>
        </Box>
      </Box>
      <List disablePadding sx={{ flex: 1 }}>
        {items.map((item) => (
          <NavEntry
            key={item.to}
            item={item}
            label={user.role === 'employee' && item.employeeLabel ? item.employeeLabel : item.label}
            badge={alertCount}
            {...(onNavigate ? { onNavigate } : {})}
          />
        ))}
      </List>
      <ListItemButton
        component={NavLink}
        to="/help"
        onClick={onNavigate}
        sx={{ borderRadius: 999, color: 'text.secondary' }}
      >
        <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
          <HelpOutlined fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={`Help & About · v${APP_VERSION}`}
          slotProps={{ primary: { variant: 'caption' } }}
        />
      </ListItemButton>
    </Box>
  );
}
