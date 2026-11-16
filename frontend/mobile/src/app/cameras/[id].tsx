import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { FALL_RISK_LABEL } from '@elderguard/shared';
import { AlertCard } from '../../alerts/AlertCard';
import { Button } from '../../components/Button';
import { CameraPicture } from '../../components/CameraPicture';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { CameraChip } from '../../components/StatusChip';
import { errorMessage } from '../../errorMessage';
import { useNow } from '../../hooks/useNow';
import { useCameras, useRecentIncidents, useResidents } from '../../queries';
import { radius, space, useColors } from '../../theme';

/** How often the camera view asks for a new picture, the same as the web tiles. */
const PICTURE_MS = 2_000;

/** M-12 Camera view: the latest picture every 2 seconds, the room's residents and recent detections. */
export default function CameraScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const focused = useIsFocused();
  const now = useNow();
  const cameras = useCameras();
  const residents = useResidents();
  const incidents = useRecentIncidents();

  if (cameras.isPending)
    return (
      <Screen underHeader centered>
        <ActivityIndicator accessibilityLabel="Loading camera" color={c.sys.primary} />
      </Screen>
    );
  if (cameras.isError)
    return (
      <Screen underHeader>
        <Notice tone="error">{errorMessage(cameras.error)}</Notice>
        <Button label="Try again" variant="outlined" onPress={() => void cameras.refetch()} />
      </Screen>
    );
  const camera = cameras.data.find((cam) => cam.id === id);
  if (!camera)
    return (
      <Screen underHeader>
        <Notice tone="error">This camera does not exist.</Notice>
      </Screen>
    );

  const inRoom =
    camera.roomId === null ? [] : (residents.data ?? []).filter((r) => r.room?.id === camera.roomId);
  const detections = (incidents.data ?? []).filter((i) => i.camera?.code === camera.code).slice(0, 5);

  return (
    <Screen underHeader>
      <Stack.Screen options={{ title: camera.code }} />
      <CameraPicture camera={camera} active={focused} everyMs={PICTURE_MS} />
      <View style={styles.row}>
        <Text style={[styles.title, { color: c.sys.onSurface }]}>
          {[camera.roomName, camera.roomWing].filter(Boolean).join(' · ') || 'No room'}
        </Text>
        <CameraChip status={camera.status} />
      </View>
      <Text style={{ color: c.sys.onSurfaceVariant }}>
        New picture every 2 seconds{camera.resolutionFps ? ` · ${camera.resolutionFps}` : ''}
      </Text>

      <View style={[styles.section, { backgroundColor: c.sys.surfaceContainerLow }]}>
        <Text role="heading" style={[styles.sectionTitle, { color: c.sys.onSurface }]}>
          Residents in this room
        </Text>
        {residents.isPending ? (
          <ActivityIndicator color={c.sys.primary} />
        ) : inRoom.length === 0 ? (
          <Text style={{ color: c.sys.onSurfaceVariant }}>No residents assigned to this room.</Text>
        ) : (
          inRoom.map((r) => (
            <Text key={r.id} style={{ color: c.sys.onSurface }}>
              {[r.fullName, r.age, FALL_RISK_LABEL[r.fallRisk]].filter((x) => x !== null).join(' · ')}
            </Text>
          ))
        )}
      </View>

      <Text role="heading" style={[styles.sectionTitle, { color: c.sys.onSurface }]}>
        Recent detections
      </Text>
      {incidents.isPending ? (
        <ActivityIndicator color={c.sys.primary} />
      ) : detections.length === 0 ? (
        <Text style={{ color: c.sys.onSurfaceVariant }}>No alerts from this camera.</Text>
      ) : (
        detections.map((i) => <AlertCard key={i.code} incident={i} now={now} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.space8 },
  title: { fontSize: 20, fontWeight: '600', flex: 1 },
  section: { borderRadius: radius.radiusMd, padding: space.space16, gap: space.space8 },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
});
