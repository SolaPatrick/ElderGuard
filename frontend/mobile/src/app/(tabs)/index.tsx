import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  cameraNeedsAttention,
  cameraSummary,
  formatDate,
  formatTime,
  incidentTitle,
  isActiveStatus,
} from '@elderguard/shared';
import { AlertCard } from '../../alerts/AlertCard';
import { useCurrentUser } from '../../auth/authContext';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { CameraChip, StatusChip } from '../../components/StatusChip';
import { errorMessage } from '../../errorMessage';
import { useNow } from '../../hooks/useNow';
import {
  useAcknowledge,
  useActiveIncidents,
  useCameras,
  useDashboardSummary,
  useIncidentHistory,
  useResidents,
} from '../../queries';
import { radius, size, space, useColors } from '../../theme';

const SHOWN = 3;

/** M-09 (caregiver) and M-10 (Admin/Head) home. */
export default function HomeScreen() {
  const user = useCurrentUser();
  const c = useColors();
  const isAdmin = user.role === 'admin';
  return (
    <Screen underHeader>
      <View>
        <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
          Hello, {user.fullName}
        </Text>
        <Text style={{ color: c.sys.onSurfaceVariant }}>{user.title}</Text>
      </View>
      {isAdmin && <AdminFigures />}
      <ActiveAlerts />
      <CameraHealth title={user.areas.length > 0 ? 'My cameras' : 'Cameras'} />
      {!isAdmin && <MyResidents />}
      {!isAdmin && <RecentIncidents />}
      {isAdmin && (
        <Notice tone="info">
          Rooms, cameras, residents and staff accounts are managed on the ElderGuard web console.
        </Notice>
      )}
    </Screen>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text role="heading" style={[styles.sectionTitle, { color: c.sys.onSurface }]}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function SeeAll({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={12}>
      <Text style={{ color: c.sys.primary, fontWeight: '600' }}>See all</Text>
    </Pressable>
  );
}

function Loading({ label }: { label: string }) {
  const c = useColors();
  return <ActivityIndicator accessibilityLabel={label} color={c.sys.primary} />;
}

function Muted({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.sys.onSurfaceVariant }}>{children}</Text>;
}

/** M-10 key figures, from the same summary the web dashboard uses. */
function AdminFigures() {
  const c = useColors();
  const q = useDashboardSummary(true);
  if (q.isPending) return <Loading label="Loading figures" />;
  if (q.isError) return <Notice tone="error">{errorMessage(q.error)}</Notice>;
  const s = q.data;
  const figures = [
    { label: 'Active alerts', value: String(s.activeAlerts.total), urgent: s.activeAlerts.total > 0 },
    { label: 'Cameras online', value: `${s.cameras.online} of ${s.cameras.total}`, urgent: false },
    { label: 'Incidents today', value: String(s.incidentsToday.total), urgent: false },
  ];
  return (
    <View style={styles.figures} accessibilityRole="summary">
      {figures.map((f) => (
        <View
          key={f.label}
          accessible
          accessibilityLabel={`${f.label}: ${f.value}`}
          style={[
            styles.figure,
            f.urgent
              ? { backgroundColor: c.sys.criticalContainer, borderColor: c.sys.critical }
              : { backgroundColor: c.sys.surfaceContainerLow, borderColor: c.sys.outlineVariant },
          ]}
        >
          <Text
            style={[styles.figureValue, { color: f.urgent ? c.sys.onCriticalContainer : c.sys.onSurface }]}
          >
            {f.value}
          </Text>
          <Text
            style={{ color: f.urgent ? c.sys.onCriticalContainer : c.sys.onSurfaceVariant, fontSize: 13 }}
          >
            {f.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The oldest open alerts first, with Acknowledge right here. */
function ActiveAlerts() {
  const now = useNow();
  const q = useActiveIncidents();
  const acknowledge = useAcknowledge();
  const list = (q.data ?? []).toSorted((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt));
  return (
    <Section
      title={list.length > 0 ? `Active alerts · ${list.length}` : 'Active alerts'}
      action={
        list.length > SHOWN ? (
          <SeeAll label="See all active alerts" onPress={() => router.push('/alerts')} />
        ) : undefined
      }
    >
      {q.isPending ? (
        <Loading label="Loading alerts" />
      ) : q.isError ? (
        <Notice tone="error">{errorMessage(q.error)}</Notice>
      ) : list.length === 0 ? (
        <Muted>No active alerts. New alerts show here and sound an alarm.</Muted>
      ) : (
        <>
          {acknowledge.isError && <Notice tone="error">{errorMessage(acknowledge.error)}</Notice>}
          {list.slice(0, SHOWN).map((i) => (
            <AlertCard
              key={i.code}
              incident={i}
              now={now}
              onAcknowledge={() => acknowledge.mutate(i.code)}
              acknowledging={acknowledge.isPending && acknowledge.variables === i.code}
            />
          ))}
        </>
      )}
    </Section>
  );
}

/** Caregivers: how many cameras work and which don't. Admin/Head: only the ones that don't. */
function CameraHealth({ title }: { title: string }) {
  const c = useColors();
  const q = useCameras();
  const cams = q.data ?? [];
  const broken = cams.filter(cameraNeedsAttention);
  return (
    <Section
      title={title}
      action={<SeeAll label="See all cameras" onPress={() => router.push('/cameras')} />}
    >
      {q.isPending ? (
        <Loading label="Loading cameras" />
      ) : q.isError ? (
        <Notice tone="error">{errorMessage(q.error)}</Notice>
      ) : cams.length === 0 ? (
        <Muted>No cameras yet.</Muted>
      ) : (
        <>
          <Muted>{cameraSummary(cams)}</Muted>
          {broken.map((cam) => (
            <Pressable
              key={cam.id}
              onPress={() => router.push(`/cameras/${cam.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${cam.code}, ${cam.roomName ?? 'no room'}, ${cam.status}`}
              style={[
                styles.row,
                { borderColor: c.sys.outlineVariant, backgroundColor: c.sys.surfaceContainerLow },
              ]}
            >
              <View style={styles.rowText}>
                <Text style={{ color: c.sys.onSurface, fontWeight: '600' }}>{cam.code}</Text>
                <Text style={{ color: c.sys.onSurfaceVariant }}>
                  {cam.statusDetail ?? cam.roomName ?? '—'}
                </Text>
              </View>
              <CameraChip status={cam.status} />
            </Pressable>
          ))}
        </>
      )}
    </Section>
  );
}

/** M-09 residents summary: how many, and who is in an open alert. */
function MyResidents() {
  const user = useCurrentUser();
  const q = useResidents();
  const list = q.data ?? [];
  const inAlert = list.filter((r) => r.hasActiveAlert);
  return (
    <Section
      title={user.areas.length > 0 ? 'My residents' : 'Residents'}
      action={<SeeAll label="See all residents" onPress={() => router.push('/residents')} />}
    >
      {q.isPending ? (
        <Loading label="Loading residents" />
      ) : q.isError ? (
        <Notice tone="error">{errorMessage(q.error)}</Notice>
      ) : (
        <Muted>
          {list.length === 0
            ? 'No residents yet.'
            : `${list.length} ${list.length === 1 ? 'resident' : 'residents'}` +
              (inAlert.length > 0
                ? ` · in an open alert: ${inAlert.map((r) => r.fullName).join(', ')}`
                : ' · none in an open alert')}
        </Muted>
      )}
    </Section>
  );
}

/** M-09 recent incidents: the latest closed alerts. */
function RecentIncidents() {
  const c = useColors();
  const q = useIncidentHistory();
  const closed = (q.data ?? []).filter((i) => !isActiveStatus(i.status)).slice(0, SHOWN);
  return (
    <Section
      title="Recent incidents"
      action={<SeeAll label="See all incidents" onPress={() => router.push('/alerts')} />}
    >
      {q.isPending ? (
        <Loading label="Loading recent incidents" />
      ) : q.isError ? (
        <Notice tone="error">{errorMessage(q.error)}</Notice>
      ) : closed.length === 0 ? (
        <Muted>No closed alerts yet.</Muted>
      ) : (
        closed.map((i) => (
          <Pressable
            key={i.code}
            onPress={() => router.push(`/alerts/${i.code}`)}
            accessibilityRole="button"
            accessibilityLabel={`${incidentTitle(i)}, ${i.room.name}, ${`${formatDate(i.detectedAt)}, ${formatTime(i.detectedAt)}`}`}
            style={[
              styles.row,
              { borderColor: c.sys.outlineVariant, backgroundColor: c.sys.surfaceContainerLow },
            ]}
          >
            <View style={styles.rowText}>
              <Text style={{ color: c.sys.onSurface, fontWeight: '600' }}>
                {incidentTitle(i)} · {i.room.name}
              </Text>
              <Text
                style={{ color: c.sys.onSurfaceVariant }}
              >{`${formatDate(i.detectedAt)}, ${formatTime(i.detectedAt)}`}</Text>
            </View>
            <StatusChip status={i.status} />
          </Pressable>
        ))
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600' },
  section: { gap: space.space8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  figures: { flexDirection: 'row', gap: space.space8 },
  figure: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
    padding: space.space12,
    gap: space.space4,
  },
  figureValue: { fontSize: 20, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.space12,
    borderWidth: 1,
    borderRadius: radius.radiusMd,
    padding: space.space12,
    minHeight: size.targetMobile,
  },
  rowText: { flex: 1, gap: space.space4 },
});
