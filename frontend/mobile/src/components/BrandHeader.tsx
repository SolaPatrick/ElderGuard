import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { radius, space, useColors } from '../theme';

export function BrandHeader() {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { backgroundColor: c.sys.primaryContainer }]}>
        <MaterialIcons name="shield" size={28} color={c.sys.onPrimaryContainer} />
      </View>
      <Text style={[styles.name, { color: c.sys.onSurface }]}>ElderGuard</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.space12 },
  mark: {
    width: 48,
    height: 48,
    borderRadius: radius.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 22, fontWeight: '600' },
});
