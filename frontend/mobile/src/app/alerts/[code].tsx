import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  formatDate,
  formatElapsed,
  formatTime,
  formatTimeWithSeconds,
  incidentPersonName,
  incidentTitle,
  isActiveStatus,
  numbers,
  secondsBetween,
  type IncidentDetail,
  type IncidentEventAction,
} from '@elderguard/shared';
import { ApiError } from '../../api';
import { ClassifySheet } from '../../alerts/ClassifySheet';
import { NoteSheet } from '../../alerts/NoteSheet';
import { ResolveSheet } from '../../alerts/ResolveSheet';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { Snapshot } from '../../components/Snapshot';
import { StatusChip } from '../../components/StatusChip';
import { errorMessage } from '../../errorMessage';
import { useNow } from '../../hooks/useNow';
import { useAcknowledge, useIncident } from '../../queries';
import { radius, space, useColors } from '../../theme';

const STEPS: { action: IncidentEventAction; label: string }[] = [
  { action: 'detected', label: 'Detected' },
  { action: 'acknowledged', label: 'Acknowledged' },
  { action: 'classified', label: 'Classified' },
  { action: 'resolved', label: 'Resolved' },
];

/** M-15 Alert detail: evidence, details, timeline, notes, and the next step in a bar at the bottom. */
export default function AlertDetailScreen() {
  const { code = '' } = useLocalSearchParams<{ code: string }>();
  const c = useColors();
  const query = useIncident(code);
  const now = useNow();
  const acknowledge = useAcknowledge();
  const [sheet, setSheet] = useState<'classify' | 'resolve' | 'note' | null>(null);

  if (query.isPending) {
    return (
      <Screen centered underHeader>
        <Stack.Screen options={{ title: code }} />
        <ActivityIndicator accessibilityLabel="Loading alert" color={c.sys.primary} />
      </Screen>
    );
  }
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Screen centered underHeader>
        <Stack.Screen options={{ title: code }} />
        <Notice tone="error">{missing ? 'This alert does not exist.' : errorMessage(query.error)}</Notice>
        {!missing && <Button label="Try again" variant="outlined" onPress={() => void query.refetch()} />}
      </Screen>
    );
  }

  const incident = query.data;
  const open = isActiveStatus(incident.status);
  const end = incident.resolvedAt ? Date.parse(incident.resolvedAt) : now;
  const next =
    incident.status === 'new'
      ? {
          label: 'Acknowledge',
          onPress: () => acknowledge.mutate(incident.code),
          loading: acknowledge.isPending,
        }
      : incident.status === 'acknowledged'
        ? { label: 'Classify', onPress: () => setSheet('classify'), loading: false }
        : incident.status === 'confirmed'
          ? { label: 'Resolve', onPress: () => setSheet('resolve'), loading: false }
          : null;

  return (
    <View style={[styles.fill, { backgroundColor: c.sys.surface }]}>
      <Stack.Screen options={{ title: incident.code }} />
      <Screen underHeader>
        <View style={styles.titleRow}>
          <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
            {incident.type === 'sos' ? `SOS · ${incident.room.name}` : incidentTitle(incident)}
          </Text>
          <StatusChip status={incident.status} />
        </View>
        <Snapshot
          uri={incident.snapshotUrl}
          alerting={incident.status === 'new'}
          caption={incident.camera ? `Evidence · ${incident.camera.code}` : 'No camera for this alert (SOS)'}
        />
        <Section title="Details">
          <Row
            label={incident.type === 'sos' ? 'Sent by' : 'Resident'}
            value={incidentPersonName(incident)}
          />
          <Row label="Room" value={[incident.room.name, incident.room.wing].filter(Boolean).join(' · ')} />
          <Row label="Camera" value={incident.camera?.code ?? '—'} />
          <Row
            label="Date and time"
            value={`${formatTime(incident.detectedAt)} · ${formatDate(incident.detectedAt)}`}
          />
          <Row
            label="Detection confidence"
            value={incident.confidence === null ? '—' : `${Math.round(incident.confidence * 100)}%`}
          />
          <Row
            label={open ? 'Elapsed' : 'Time to close'}
            value={formatElapsed(secondsBetween(incident.detectedAt, end))}
          />
          {incident.outcome && <Row label="Outcome" value={incident.outcome} />}
          {incident.falseAlarmReason && <Row label="False alarm reason" value={incident.falseAlarmReason} />}
        </Section>
        <Section title="Status timeline">
          <Timeline incident={incident} />
        </Section>
        <Section title="Response notes">
          {incident.notes.length === 0 ? (
            <Text style={{ color: c.sys.onSurfaceVariant }}>No notes yet.</Text>
          ) : (
            incident.notes.map((n) => (
              <View key={n.id} style={styles.note}>
                <Text style={{ color: c.sys.onSurface }}>{n.body}</Text>
                <Text style={{ color: c.sys.onSurfaceVariant, fontSize: 12 }}>
                  {n.author.fullName} · {formatTime(n.createdAt)}
                </Text>
              </View>
            ))
          )}
        </Section>
      </Screen>
      <SafeAreaView
        edges={['bottom']}
        style={[styles.bar, { backgroundColor: c.sys.surfaceContainer, borderColor: c.sys.outlineVariant }]}
      >
        {acknowledge.isError && <Notice tone="error">{errorMessage(acknowledge.error)}</Notice>}
        <View style={styles.barButtons}>
          <View style={styles.barButton}>
            <Button label="Add note" variant="outlined" onPress={() => setSheet('note')} />
          </View>
          {next && (
            <View style={styles.barButton}>
              <Button label={next.label} onPress={next.onPress} loading={next.loading} />
            </View>
          )}
        </View>
      </SafeAreaView>
      <ClassifySheet open={sheet === 'classify'} incident={incident} onClose={() => setSheet(null)} />
      <ResolveSheet open={sheet === 'resolve'} incident={incident} onClose={() => setSheet(null)} />
      <NoteSheet open={sheet === 'note'} incident={incident} onClose={() => setSheet(null)} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.section, { backgroundColor: c.sys.surfaceContainerLow }]}>
      <Text role="heading" style={[styles.sectionTitle, { color: c.sys.onSurface }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Text style={{ color: c.sys.onSurfaceVariant, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: c.sys.onSurface, fontSize: 15 }}>{value}</Text>
    </View>
  );
}

/** Each step shows when and by whom, or "Waiting", the same as the web. */
function Timeline({ incident }: { incident: IncidentDetail }) {
  const c = useColors();
  const closedAsFalseAlarm = incident.status === 'false_alarm';
  return (
    <View role="list" aria-label="Status timeline">
      {STEPS.map((step, idx) => {
        const event = incident.events.findLast((e) => e.action === step.action);
        const skipped = step.action === 'resolved' && closedAsFalseAlarm;
        const done = event !== undefined || skipped;
        const detail = event
          ? [formatTimeWithSeconds(event.occurredAt), event.user?.fullName, event.detail]
              .filter(Boolean)
              .join(' · ')
          : skipped
            ? 'Closed as false alarm'
            : 'Waiting';
        return (
          <View role="listitem" key={step.action} style={styles.step}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: done ? c.sys.primary : c.sys.outline,
                    backgroundColor: done ? c.sys.primary : 'transparent',
                  },
                ]}
              />
              {idx < STEPS.length - 1 && (
                <View
                  style={[styles.line, { backgroundColor: done ? c.sys.primary : c.sys.outlineVariant }]}
                />
              )}
            </View>
            <View style={styles.stepText}>
              <Text style={{ color: done ? c.sys.onSurface : c.sys.onSurfaceVariant, fontWeight: '600' }}>
                {step.label}
              </Text>
              <Text style={{ color: c.sys.onSurfaceVariant, fontSize: 12 }}>{detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.space8 },
  title: { fontSize: 22, fontWeight: '600', flex: 1 },
  section: { borderRadius: radius.radiusMd, padding: space.space16, gap: space.space12 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  row: { gap: 2 },
  note: { gap: 2 },
  step: { flexDirection: 'row', gap: space.space12 },
  rail: { alignItems: 'center', paddingTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  line: { width: 2, flex: 1, minHeight: 28 },
  stepText: { paddingBottom: space.space12, flex: 1 },
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: numbers.layout.mobileMargin,
    paddingTop: space.space12,
    paddingBottom: space.space12,
    gap: space.space8,
  },
  barButtons: { flexDirection: 'row', gap: space.space12 },
  barButton: { flex: 1 },
});
