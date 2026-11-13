import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius, size, space, useColors } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text';
  loading?: boolean;
  disabled?: boolean;
}

/** A button at least 48 px tall, the touch target size in the design tokens. */
export function Button({ label, onPress, variant = 'filled', loading = false, disabled = false }: Props) {
  const c = useColors();
  const inactive = disabled || loading;
  const filled = variant === 'filled';
  const labelColor = filled ? c.comp.buttonFilledLabel : c.sys.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        filled && { backgroundColor: c.comp.buttonFilledContainer },
        variant === 'outlined' && { borderWidth: 1, borderColor: c.sys.outline },
        { opacity: disabled ? 0.38 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: size.targetMobile,
    borderRadius: radius.radiusFull,
    paddingHorizontal: space.space24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
