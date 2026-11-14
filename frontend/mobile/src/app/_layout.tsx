// Gives the phone a localStorage (kept with expo-sqlite) for notification read state; does nothing on web.
import 'expo-sqlite/localStorage/install';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { IncomingAlert } from '../alerts/IncomingAlert';
import { AuthProvider } from '../auth/AuthProvider';
import { useAppFocus } from '../hooks/useAppFocus';
import { useAuth } from '../auth/authContext';
import { useActiveIncidents } from '../queries';
import { useColors, useIsDark } from '../theme';

// M-01: keep the splash screen up until the saved sign-in has been checked.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useAppFocus();
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 2_000 } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SplashScreenController />
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function SplashScreenController() {
  const { state } = useAuth();
  if (state.status !== 'loading') SplashScreen.hide();
  return null;
}

function RootNavigator() {
  const { state } = useAuth();
  const c = useColors();
  const dark = useIsDark();
  const signedIn = state.status === 'authenticated';
  // M-07: a temporary password must be changed before anything else.
  const mustChange = signedIn && state.user.mustChangePassword;
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: c.sys.surface },
    headerTintColor: c.sys.onSurface,
  };
  // Headers and tab bars take their border and background from the navigation theme.
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.sys.primary,
      background: c.sys.surface,
      card: c.sys.surface,
      text: c.sys.onSurface,
      border: c.sys.outlineVariant,
      notification: c.sys.critical,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.sys.surface } }}>
        <Stack.Protected guard={signedIn && !mustChange}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="alerts/[code]" options={{ ...header, headerBackTitle: 'Alerts' }} />
          <Stack.Screen name="cameras/[id]" options={{ ...header, headerBackTitle: 'Cameras' }} />
          <Stack.Screen name="residents/index" options={{ ...header, title: 'Residents' }} />
          <Stack.Screen name="residents/[id]" options={{ ...header, headerBackTitle: 'Residents' }} />
          <Stack.Screen name="notifications" options={{ ...header, title: 'Notifications' }} />
          <Stack.Screen name="profile" options={{ ...header, title: 'Profile & settings' }} />
          <Stack.Screen name="help" options={{ ...header, title: 'Help & About' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
      </Stack>
      {signedIn && !mustChange && <AlertWatcher />}
    </ThemeProvider>
  );
}

/** M-14 shows over every screen while the user is signed in. */
function AlertWatcher() {
  const { data } = useActiveIncidents();
  return <IncomingAlert incidents={data ?? []} />;
}
