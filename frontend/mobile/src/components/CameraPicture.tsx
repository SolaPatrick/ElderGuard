import { Image, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Camera } from '@elderguard/shared';
import { useCameraPicture } from '../queries';
import { radius, space, useColors } from '../theme';

/**
 * The camera's newest picture, refreshed every `everyMs` while `active`. Phones cannot show the
 * MJPEG stream reliably in an image, so both the list and the camera view use pictures.
 */
export function CameraPicture({
  camera,
  active,
  everyMs,
}: {
  camera: Camera;
  active: boolean;
  everyMs: number;
}) {
  const c = useColors();
  const canShow = camera.detectionEnabled && camera.status !== 'offline';
  const { data, isError } = useCameraPicture(camera.id, active && canShow, everyMs);
  const empty = !camera.detectionEnabled
    ? 'No picture while fall detection is paused'
    : camera.status === 'offline'
      ? 'Camera offline'
      : isError
        ? 'No picture from the camera'
        : 'Loading picture…';
  return (
    <View style={[styles.well, { backgroundColor: c.comp.cameraWell }]}>
      {canShow && data ? (
        <Image
          source={{ uri: data }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          accessibilityLabel={`Latest picture from ${camera.code}`}
        />
      ) : (
        <View style={styles.empty}>
          <MaterialIcons name="videocam-off" size={28} color={c.comp.cameraOverlayText} />
          <Text style={{ color: c.comp.cameraOverlayText, fontSize: 13 }}>{empty}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  well: { aspectRatio: 16 / 9, borderRadius: radius.radiusMd, overflow: 'hidden', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: space.space8, padding: space.space16 },
});
