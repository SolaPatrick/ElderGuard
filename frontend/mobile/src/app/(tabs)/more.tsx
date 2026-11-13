import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useCurrentUser } from '../../auth/authContext';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { API_BASE_URL } from '../../config';
import { radius, space, useColors } from '../../theme';

/** Start of M-28 More: the signed-in account, Change password (M-30) and Log out. */
export default function MoreScreen() {
  const { logout } = useAuth();
  const user = useCurrentUser();
  const c = useColors();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  return (
    <Screen underHeader>
      <View style={[styles.card, { backgroundColor: c.sys.surfaceContainerLow }]}>
        <Text style={[styles.name, { color: c.sys.onSurface }]}>{user.fullName}</Text>
        <Text style={{ color: c.sys.onSurfaceVariant }}>
          {user.title} · {user.username}
        </Text>
      </View>
      <Button label="Change password" variant="outlined" onPress={() => router.push('/change-password')} />
      {confirming ? (
        <View style={[styles.card, { borderColor: c.sys.outlineVariant, borderWidth: 1 }]}>
          <Text style={{ color: c.sys.onSurface }}>
            Log out of ElderGuard? This phone will stop showing alerts until you log in again.
          </Text>
          <Button
            label="Log out"
            loading={leaving}
            onPress={() => {
              setLeaving(true);
              void logout();
            }}
          />
          <Button label="Cancel" variant="text" onPress={() => setConfirming(false)} disabled={leaving} />
        </View>
      ) : (
        <Button label="Log out" variant="text" onPress={() => setConfirming(true)} />
      )}
      <Text style={[styles.server, { color: c.sys.onSurfaceVariant }]}>Server: {API_BASE_URL}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.radiusMd, padding: space.space16, gap: space.space8 },
  name: { fontSize: 20, fontWeight: '600' },
  server: { fontSize: 12, textAlign: 'center' },
});
