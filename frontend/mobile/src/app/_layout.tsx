import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { IncomingAlert } from '../alerts/IncomingAlert';
import { AuthProvider } from '../auth/AuthProvider';
import { useAppFocus } from '../hooks/useAppFocus';
import { useAuth } from '../auth/authContext';
import { useActiveIncidents } from '../queries';
import { useColors } from '../theme';

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
  const signedIn = state.status === 'authenticated';
  // M-07: a temporary password must be changed before anything else.
  const mustChange = signedIn && state.user.mustChangePassword;
  const header = {
    headerShown: true,
    headerStyle: { backgroundColor: c.sys.surface },
    headerTintColor: c.sys.onSurface,
  };
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.sys.surface } }}>
        <Stack.Protected guard={signedIn && !mustChange}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="alerts/[code]" options={{ ...header, headerBackTitle: 'Alerts' }} />
          <Stack.Screen name="cameras/[id]" options={{ ...header, headerBackTitle: 'Cameras' }} />
          <Stack.Screen name="residents/index" options={{ ...header, title: 'Residents' }} />
          <Stack.Screen name="residents/[id]" options={{ ...header, headerBackTitle: 'Residents' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      {signedIn && !mustChange && <AlertWatcher />}
    </>
  );
}

/** M-14 shows over every screen while the user is signed in. */
function AlertWatcher() {
  const { data } = useActiveIncidents();
  return <IncomingAlert incidents={data ?? []} />;
}
