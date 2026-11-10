import { useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsOutlined from '@mui/icons-material/NotificationsOutlined';
import Sos from '@mui/icons-material/Sos';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import Logout from '@mui/icons-material/Logout';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { initials, numbers, type User } from '@elderguard/shared';
import { useAuth } from '../auth/authContext';
import { StatusChip } from '../components/StatusChip';
import { USE_MOCKS } from '../api/config';
import { simulateFall } from '../mocks/devTools';
import { errorMessage } from '../components/errorMessage';
import { SosDialog } from '../features/sos/SosDialog';

export function TopBar({
  user,
  facilityName,
  alertCount,
  connectionLost,
  onOpenNav,
}: {
  user: User;
  facilityName: string;
  alertCount: number;
  connectionLost: boolean;
  onOpenNav: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { mode, systemMode, setMode } = useColorScheme();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const isDark = (mode === 'system' ? systemMode : mode) === 'dark';

  const runSimulateFall = async () => {
    setMenuAnchor(null);
    try {
      const incident = await simulateFall();
      setToast(`Simulated ${incident.code}. The alert will appear in a few seconds.`);
      void queryClient.invalidateQueries({ queryKey: ['incidents'] });
    } catch (err) {
      setToast(errorMessage(err));
    }
  };

  return (
    <Box
      component="header"
      sx={{
        height: numbers.layout.topBarHeight,
        px: { xs: 3, md: 8 },
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <IconButton onClick={onOpenNav} aria-label="Open menu" sx={{ display: { lg: 'none' } }}>
        <MenuIcon />
      </IconButton>
      <Typography variant="subtitle1" component="div" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
        {facilityName}
      </Typography>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        {connectionLost ? (
          <StatusChip kind="system" status="down" label="Connection lost" />
        ) : (
          <StatusChip kind="system" status="operational" label="All systems normal" />
        )}
      </Box>
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Alerts">
        <IconButton onClick={() => navigate('/alerts')} aria-label={`Alerts, ${alertCount} active`}>
          <Badge badgeContent={alertCount} color="error">
            <NotificationsOutlined />
          </Badge>
        </IconButton>
      </Tooltip>
      <Button
        variant="contained"
        startIcon={<Sos />}
        onClick={() => setSosOpen(true)}
        aria-haspopup="dialog"
        sx={{
          bgcolor: 'eg.comp.sosFill',
          color: 'eg.comp.sosLabel',
          '&:hover': { bgcolor: 'eg.comp.sosFill' },
        }}
      >
        SOS
      </Button>
      <SosDialog open={sosOpen} onClose={() => setSosOpen(false)} />
      <Button
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        color="inherit"
        endIcon={<KeyboardArrowDown />}
        aria-haspopup="menu"
        aria-expanded={menuAnchor ? 'true' : undefined}
        sx={{ borderRadius: 999, px: 2 }}
      >
        <Stack direction="row" spacing={3} sx={{ alignItems: 'center', textAlign: 'left' }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'eg.sys.primaryContainer',
              color: 'eg.sys.onPrimaryContainer',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {initials(user.fullName)}
          </Avatar>
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography variant="subtitle2" component="div">
              {user.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div">
              {user.title}
            </Typography>
          </Box>
        </Stack>
      </Button>

      <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMode(isDark ? 'light' : 'dark');
            setMenuAnchor(null);
          }}
        >
          <ListItemIcon>
            {isDark ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
          </ListItemIcon>
          {isDark ? 'Day mode' : 'Night mode'}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            void navigate('/notifications');
          }}
        >
          <ListItemIcon>
            <NotificationsOutlined fontSize="small" />
          </ListItemIcon>
          Notifications
        </MenuItem>
        {USE_MOCKS && (
          <MenuItem onClick={runSimulateFall}>
            <ListItemIcon>
              <ScienceOutlined fontSize="small" />
            </ListItemIcon>
            Simulate a fall (demo)
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setConfirmLogout(true);
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Log out
        </MenuItem>
      </Menu>

      <Dialog open={confirmLogout} onClose={() => setConfirmLogout(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log out?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You will stop receiving alerts on this computer until you log in again.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 6, pb: 5 }}>
          <Button variant="outlined" onClick={() => setConfirmLogout(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void logout()}>
            Log out
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
