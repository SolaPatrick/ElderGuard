import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { incidentTitle } from '@elderguard/shared';
import { useCurrentUser } from '../../auth/authContext';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { errorMessage } from '../../errorMessage';
import { useActiveIncidents } from '../../queries';
import { radius, space, useColors } from '../../theme';

/** Home (start of M-09 / M-10): who is signed in and how many alerts are open. */
export default function HomeScreen() {
  const user = useCurrentUser();
  const c = useColors();
  const { data, error, isPending } = useActiveIncidents();
  const oldest = data?.toSorted((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt))[0];

  return (
    <Screen underHeader>
      <View>
        <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
          Hello, {user.fullName}
        </Text>
        <Text style={{ color: c.sys.onSurfaceVariant }}>{user.title}</Text>
      </View>
      {error && <Notice tone="error">{errorMessage(error)}</Notice>}
      {isPending ? (
        <ActivityIndicator accessibilityLabel="Loading alerts" color={c.sys.primary} />
      ) : (
        data && (
          <View
            style={[
              styles.card,
              data.length > 0
                ? { backgroundColor: c.sys.criticalContainer, borderColor: c.sys.critical }
                : { backgroundColor: c.sys.surfaceContainerLow, borderColor: c.sys.outlineVariant },
            ]}
          >
            <Text
              style={[styles.count, { color: data.length > 0 ? c.sys.onCriticalContainer : c.sys.onSurface }]}
            >
              {data.length === 0
                ? 'No active alerts'
                : `${data.length} active ${data.length === 1 ? 'alert' : 'alerts'}`}
            </Text>
            {oldest && (
              <Text style={{ color: c.sys.onCriticalContainer }}>
                Oldest: {incidentTitle(oldest)} · {oldest.room.name}
              </Text>
            )}
          </View>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: radius.radiusMd, padding: space.space16, gap: space.space4 },
  count: { fontSize: 20, fontWeight: '600' },
});
