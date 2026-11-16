import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { radius, space, useColors } from '../theme';

/**
 * The camera picture saved with an alert. Without one, the panel says so instead of showing the
 * caption: SOS alerts have no camera, and test alerts from the backend have no picture.
 */
export function Snapshot({
  uri,
  caption,
  alerting = false,
}: {
  uri: string | null;
  caption: string;
  alerting?: boolean;
}) {
  const c = useColors();
  const [failed, setFailed] = useState(false);
  const show = uri !== null && !failed;
  return (
    <View
      style={[
        styles.well,
        { backgroundColor: c.comp.cameraWell },
        alerting && { borderColor: c.sys.critical, borderWidth: 3 },
      ]}
    >
      {show ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          accessibilityLabel={caption}
        />
      ) : (
        <MaterialIcons name="videocam-off" size={32} color={c.comp.cameraOverlayText} />
      )}
      <Text style={[styles.caption, { color: c.comp.cameraOverlayText }]}>
        {show ? caption : uri === null ? 'No snapshot for this alert' : 'Snapshot could not load'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    aspectRatio: 16 / 9,
    borderRadius: radius.radiusMd,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    position: 'absolute',
    left: space.space8,
    bottom: space.space8,
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: space.space8,
    paddingVertical: 2,
    borderRadius: radius.radiusXs,
  },
});
