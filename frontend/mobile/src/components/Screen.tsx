import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { numbers } from '@elderguard/shared';
import { space, useColors } from '../theme';

/** A scrolling page with the safe-area insets and room for the keyboard. */
export function Screen({ children, centered = false }: { children: ReactNode; centered?: boolean }) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.sys.surface }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, centered && styles.centered]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    padding: numbers.layout.mobileMargin,
    gap: space.space16,
    width: '100%',
    maxWidth: numbers.layout.mobileFrame,
    alignSelf: 'center',
  },
  centered: { flexGrow: 1, justifyContent: 'center' },
});
