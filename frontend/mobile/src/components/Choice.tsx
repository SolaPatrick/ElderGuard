import { Pressable, StyleSheet, Text, View } from 'react-native';
import { size, space, useColors } from '../theme';

/** A list of radio buttons. */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string | undefined;
}) {
  const c = useColors();
  return (
    <View role="radiogroup" aria-label={label} style={styles.group}>
      <Text style={[styles.label, { color: c.sys.onSurfaceVariant }]}>{label}</Text>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected }}
            aria-checked={selected}
            style={styles.row}
          >
            <View style={[styles.outer, { borderColor: selected ? c.sys.primary : c.sys.outline }]}>
              {selected && <View style={[styles.inner, { backgroundColor: c.sys.primary }]} />}
            </View>
            <Text style={{ color: c.sys.onSurface, fontSize: 16, flex: 1 }}>{o.label}</Text>
          </Pressable>
        );
      })}
      {error && <Text style={{ color: c.comp.fieldError, fontSize: 12 }}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.space4 },
  label: { fontSize: 14, fontWeight: '500' },
  row: { minHeight: size.targetMobile, flexDirection: 'row', alignItems: 'center', gap: space.space12 },
  outer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { width: 10, height: 10, borderRadius: 5 },
});
