import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  formatElapsed,
  formatTime,
  incidentPersonName,
  incidentTitle,
  isActiveStatus,
  secondsBetween,
  type Incident,
} from '@elderguard/shared';
import { Button } from '../components/Button';
import { StatusChip } from '../components/StatusChip';
import { radius, space, useColors } from '../theme';

/** One alert in the Alerts tab: tap for details, or Acknowledge straight from the list. */
export function AlertCard({
  incident,
  now,
  onAcknowledge,
  acknowledging,
}: {
  incident: Incident;
  now: number;
  onAcknowledge?: () => void;
  acknowledging?: boolean;
}) {
  const c = useColors();
  const isNew = incident.status === 'new';
  const open = isActiveStatus(incident.status);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isNew ? c.comp.alertWashNew : c.sys.surfaceContainerLow,
          borderColor: isNew ? c.comp.alertBorderNew : c.sys.outlineVariant,
        },
      ]}
    >
      <Pressable
        onPress={() => router.push(`/alerts/${incident.code}`)}
        accessibilityRole="link"
        accessibilityLabel={`${incidentTitle(incident)}, ${incidentPersonName(incident)}, ${incident.room.name}`}
        style={styles.main}
      >
        <View style={styles.top}>
          <Text style={[styles.title, { color: c.sys.onSurface }]}>
            {incident.type === 'sos' ? `SOS · ${incident.room.name}` : incidentTitle(incident)}
          </Text>
          <StatusChip status={incident.status} />
        </View>
        <Text style={{ color: c.sys.onSurface }}>
          {incidentPersonName(incident)} · {incident.room.name}
        </Text>
        <Text style={{ color: c.sys.onSurfaceVariant, fontSize: 13 }}>
          {incident.code} · {formatTime(incident.detectedAt)}
          {open ? ` · ${formatElapsed(secondsBetween(incident.detectedAt, now))} elapsed` : ''}
        </Text>
      </Pressable>
      {isNew && onAcknowledge && (
        <Button label="Acknowledge" onPress={onAcknowledge} loading={acknowledging ?? false} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.radiusMd, padding: space.space16, gap: space.space12 },
  main: { gap: space.space4 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.space8 },
  title: { fontSize: 17, fontWeight: '600', flex: 1 },
});
