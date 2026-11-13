import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FALL_RISK_LABEL } from '@elderguard/shared';
import { ApiError } from '../../api';
import { AlertCard } from '../../alerts/AlertCard';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { errorMessage } from '../../errorMessage';
import { useNow } from '../../hooks/useNow';
import { useRecentIncidents, useResident } from '../../queries';
import { radius, space, useColors } from '../../theme';

/** M-23 Resident profile (read-only): details, emergency contacts (tap to call) and incident history. */
export default function ResidentScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const now = useNow();
  const query = useResident(id);
  const incidents = useRecentIncidents();

  if (query.isPending)
    return (
      <Screen underHeader centered>
        <ActivityIndicator accessibilityLabel="Loading resident" color={c.sys.primary} />
      </Screen>
    );
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Screen underHeader>
        <Notice tone="error">{missing ? 'This resident does not exist.' : errorMessage(query.error)}</Notice>
        {!missing && <Button label="Try again" variant="outlined" onPress={() => void query.refetch()} />}
      </Screen>
    );
  }

  const r = query.data;
  const history = (incidents.data ?? []).filter((i) => i.resident?.id === r.id);
  const facts: [string, string | null][] = [
    ['Room', r.room ? [r.room.name, r.room.wing].filter(Boolean).join(' · ') : 'No room'],
    ['Age', r.age === null ? null : String(r.age)],
    ['Fall risk', FALL_RISK_LABEL[r.fallRisk]],
    ['Mobility aid', r.mobilityAid],
    ['Caregivers', r.caregivers.length ? r.caregivers.map((p) => p.fullName).join(', ') : null],
    ['Care notes', r.careNotes],
  ];

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: r.fullName }} />
      <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
        {r.fullName}
      </Text>
      {r.isArchived && <Notice tone="info">This resident is archived.</Notice>}
      <View style={[styles.section, { backgroundColor: c.sys.surfaceContainerLow }]}>
        {facts
          .filter((f): f is [string, string] => f[1] !== null)
          .map(([label, value]) => (
            <View key={label} style={styles.fact}>
              <Text style={{ color: c.sys.onSurfaceVariant, fontSize: 13 }}>{label}</Text>
              <Text style={{ color: c.sys.onSurface, fontSize: 15 }}>{value}</Text>
            </View>
          ))}
      </View>

      <Text role="heading" style={[styles.sectionTitle, { color: c.sys.onSurface }]}>
        Emergency contacts
      </Text>
      {r.emergencyContacts.length === 0 ? (
        <Text style={{ color: c.sys.onSurfaceVariant }}>No emergency contact saved.</Text>
      ) : (
        r.emergencyContacts.map((p) => (
          <View key={p.id} style={[styles.section, { backgroundColor: c.sys.surfaceContainerLow }]}>
            <Text style={{ color: c.sys.onSurface, fontSize: 16 }}>{p.fullName}</Text>
            {p.relationship && <Text style={{ color: c.sys.onSurfaceVariant }}>{p.relationship}</Text>}
            {/* The FastAPI backend keeps one free-text contact with no separate phone number. */}
            {p.phone !== '' && (
              <Button
                label={`Call ${p.phone}`}
                variant="outlined"
                onPress={() => void Linking.openURL(`tel:${p.phone.replace(/[^\d+]/g, '')}`)}
              />
            )}
          </View>
        ))
      )}

      <Text role="heading" style={[styles.sectionTitle, { color: c.sys.onSurface }]}>
        Incident history
      </Text>
      {incidents.isPending ? (
        <ActivityIndicator color={c.sys.primary} />
      ) : history.length === 0 ? (
        <Text style={{ color: c.sys.onSurfaceVariant }}>No incidents.</Text>
      ) : (
        history.map((i) => <AlertCard key={i.code} incident={i} now={now} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600' },
  section: { borderRadius: radius.radiusMd, padding: space.space16, gap: space.space12 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  fact: { gap: 2 },
});
