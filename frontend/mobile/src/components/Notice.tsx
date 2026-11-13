import { StyleSheet, Text, View } from 'react-native';
import { radius, space, useColors } from '../theme';

/** An inline message: "error" is read out as an alert, "info" as a status update. */
export function Notice({ tone, children }: { tone: 'error' | 'info'; children: string }) {
  const c = useColors();
  const bg = tone === 'error' ? c.sys.criticalContainer : c.sys.infoContainer;
  const fg = tone === 'error' ? c.sys.onCriticalContainer : c.sys.onInfoContainer;
  return (
    <View
      role={tone === 'error' ? 'alert' : 'status'}
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: bg }]}
    >
      <Text style={{ color: fg, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.radiusSm, padding: space.space12 },
});
