import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useIsFocused } from 'expo-router';
import { Button } from '../../components/Button';
import { CameraPicture } from '../../components/CameraPicture';
import { Notice } from '../../components/Notice';
import { Screen } from '../../components/Screen';
import { CameraChip } from '../../components/StatusChip';
import { errorMessage } from '../../errorMessage';
import { useCameras } from '../../queries';
import { radius, size, space, useColors } from '../../theme';

const ALL = 'All areas';

/** M-11 Cameras: every camera with its status and latest picture, filtered by area. */
export default function CamerasScreen() {
  const c = useColors();
  const focused = useIsFocused();
  const query = useCameras();
  const [area, setArea] = useState(ALL);

  if (query.isPending)
    return (
      <Screen underHeader centered>
        <ActivityIndicator accessibilityLabel="Loading cameras" color={c.sys.primary} />
      </Screen>
    );
  if (query.isError)
    return (
      <Screen underHeader>
        <Notice tone="error">{errorMessage(query.error)}</Notice>
        <Button label="Try again" variant="outlined" onPress={() => void query.refetch()} />
      </Screen>
    );

  const areas = [ALL, ...new Set(query.data.map((cam) => cam.roomWing).filter((w): w is string => !!w))];
  const shown = query.data
    .filter((cam) => area === ALL || cam.roomWing === area)
    .toSorted((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return (
    <Screen underHeader>
      {areas.length > 2 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {areas.map((a) => {
            const selected = a === area;
            return (
              <Pressable
                key={a}
                onPress={() => setArea(a)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.filter,
                  { borderColor: c.sys.outline },
                  selected && {
                    backgroundColor: c.comp.navActiveIndicator,
                    borderColor: c.comp.navActiveIndicator,
                  },
                ]}
              >
                <Text style={{ color: c.sys.onSurface }}>{a}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <Text style={{ color: c.sys.onSurfaceVariant }}>
        {shown.length} {shown.length === 1 ? 'camera' : 'cameras'} ·{' '}
        {shown.filter((cam) => cam.status === 'online').length} online
      </Text>
      {shown.length === 0 && (
        <Text style={{ color: c.sys.onSurfaceVariant, textAlign: 'center', padding: space.space24 }}>
          No cameras yet. The Admin/Head adds them on the web.
        </Text>
      )}
      {shown.map((cam) => (
        <Pressable
          key={cam.id}
          onPress={() => router.push(`/cameras/${cam.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`${cam.code}${cam.roomName ? ` · ${cam.roomName}` : ''}`}
          style={[styles.card, { backgroundColor: c.sys.surfaceContainerLow }]}
        >
          <CameraPicture camera={cam} active={focused} everyMs={10_000} />
          <View style={styles.row}>
            <View style={styles.name}>
              <Text style={[styles.code, { color: c.sys.onSurface }]}>{cam.code}</Text>
              <Text style={{ color: c.sys.onSurfaceVariant }}>
                {[cam.roomName, cam.roomWing].filter(Boolean).join(' · ') || 'No room'}
              </Text>
            </View>
            <CameraChip status={cam.status} />
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.space8 },
  filter: {
    minHeight: size.targetMobile - 8,
    paddingHorizontal: space.space16,
    borderWidth: 1,
    borderRadius: radius.radiusSm,
    justifyContent: 'center',
  },
  card: { borderRadius: radius.radiusMd, padding: space.space12, gap: space.space12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.space8 },
  name: { flex: 1 },
  code: { fontSize: 17, fontWeight: '600' },
});
