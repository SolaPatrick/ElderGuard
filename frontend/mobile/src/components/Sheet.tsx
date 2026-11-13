import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { numbers } from '@elderguard/shared';
import { radius, space, useColors } from '../theme';

/** A bottom sheet (M-16, M-17, M-18). Tapping outside or the back button closes it. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[styles.fill, { backgroundColor: 'rgba(0,0,0,0.4)' }]}
          onPress={onClose}
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View
          role="dialog"
          aria-label={title}
          style={[
            styles.sheet,
            { backgroundColor: c.sys.surfaceContainerLow, paddingBottom: insets.bottom + space.space16 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.sys.outlineVariant }]} />
          <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
            {title}
          </Text>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: {
    borderTopLeftRadius: radius.radiusXl,
    borderTopRightRadius: radius.radiusXl,
    paddingHorizontal: numbers.layout.mobileMargin,
    paddingTop: space.space12,
    maxHeight: '85%',
    width: '100%',
    maxWidth: numbers.layout.mobileFrame,
    alignSelf: 'center',
  },
  handle: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.space16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: space.space16 },
  body: { gap: space.space16 },
});
