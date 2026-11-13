import { useId, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { radius, size, space, useColors } from '../theme';

interface Props extends Pick<
  TextInputProps,
  'value' | 'onChangeText' | 'autoComplete' | 'textContentType' | 'returnKeyType' | 'onSubmitEditing'
> {
  label: string;
  error?: string | undefined;
  helper?: string;
  /** Hides the text and adds a Show / Hide button. */
  password?: boolean;
}

export function TextField({ label, error, helper, password = false, ...input }: Props) {
  const c = useColors();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderColor = error ? c.comp.fieldError : focused ? c.comp.fieldBorderFocus : c.comp.fieldBorder;
  const note = error ?? helper;
  return (
    <View style={styles.wrap}>
      <Text nativeID={id} style={[styles.label, { color: c.sys.onSurfaceVariant }]}>
        {label}
      </Text>
      <View style={[styles.box, { borderColor, borderWidth: focused || error ? 2 : 1 }]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          aria-labelledby={id}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={password && !visible}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { color: c.sys.onSurface }]}
          placeholderTextColor={c.sys.onSurfaceVariant}
        />
        {password && (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            style={styles.toggle}
          >
            <Text style={{ color: c.sys.primary, fontWeight: '600' }}>{visible ? 'Hide' : 'Show'}</Text>
          </Pressable>
        )}
      </View>
      {note !== undefined && (
        <Text style={[styles.note, { color: error ? c.comp.fieldError : c.sys.onSurfaceVariant }]}>
          {note}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.space4 },
  label: { fontSize: 14, fontWeight: '500' },
  box: {
    minHeight: size.targetMobile + 8,
    borderRadius: radius.radiusXs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: { flex: 1, fontSize: 16, paddingHorizontal: space.space16, paddingVertical: space.space12 },
  toggle: { minHeight: size.targetMobile, justifyContent: 'center', paddingHorizontal: space.space16 },
  note: { fontSize: 12 },
});
