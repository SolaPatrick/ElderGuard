import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { NotificationKind } from '@elderguard/shared';
import { Button } from '../components/Button';
import { Notice } from '../components/Notice';
import { Screen } from '../components/Screen';
import { errorMessage } from '../errorMessage';
import { useNotifications } from '../hooks/useNotifications';
import { radius, size, space, useColors } from '../theme';

const ICON = { fall: 'personal-injury', sos: 'sos', camera: 'videocam-off' } as const satisfies Record<
  NotificationKind,
  string
>;

/** M-27 Notifications: All / Unread; tapping one marks it read and opens it. */
export default function NotificationsScreen() {
  const c = useColors();
  const n = useNotifications();
  const [onlyUnread, setOnlyUnread] = useState(false);

  if (n.isPending)
    return (
      <Screen underHeader centered>
        <ActivityIndicator accessibilityLabel="Loading notifications" color={c.sys.primary} />
      </Screen>
    );
  if (n.error)
    return (
      <Screen underHeader>
        <Notice tone="error">{errorMessage(n.error)}</Notice>
        <Button label="Try again" variant="outlined" onPress={n.refetch} />
      </Screen>
    );

  const shown = onlyUnread ? n.items.filter(n.unread) : n.items;

  return (
    <Screen underHeader>
      <View role="tablist" style={[styles.segments, { borderColor: c.sys.outline }]}>
        {([false, true] as const).map((unreadTab) => {
          const selected = unreadTab === onlyUnread;
          return (
            <Pressable
              key={String(unreadTab)}
              role="tab"
              aria-selected={selected}
              onPress={() => setOnlyUnread(unreadTab)}
              style={[styles.segment, selected && { backgroundColor: c.comp.navActiveIndicator }]}
            >
              <Text style={{ color: c.sys.onSurface, fontWeight: selected ? '600' : '400' }}>
                {unreadTab ? `Unread (${n.unreadCount})` : 'All'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {n.unreadCount > 0 && <Button label="Mark all as read" variant="text" onPress={n.markAllRead} />}
      {shown.length === 0 && (
        <Text style={{ color: c.sys.onSurfaceVariant, textAlign: 'center', padding: space.space24 }}>
          {onlyUnread ? 'Nothing unread.' : 'No notifications yet.'}
        </Text>
      )}
      {shown.map((item) => {
        const unread = n.unread(item);
        return (
          <Pressable
            key={item.id}
            onPress={() => {
              if (unread) n.setRead(item, true);
              router.push(item.to as never);
            }}
            onLongPress={() => n.setRead(item, !unread)}
            accessibilityRole="link"
            accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.title}. ${item.detail}`}
            accessibilityHint="Long press to mark as read or unread"
            style={[
              styles.item,
              { backgroundColor: unread ? c.sys.surfaceContainerHigh : c.sys.surfaceContainerLow },
            ]}
          >
            <MaterialIcons
              name={ICON[item.kind]}
              size={24}
              color={item.kind === 'camera' ? c.sys.onSurfaceVariant : c.sys.critical}
            />
            <View style={styles.text}>
              <Text style={{ color: c.sys.onSurface, fontWeight: unread ? '700' : '400' }}>{item.title}</Text>
              <Text style={{ color: c.sys.onSurfaceVariant, fontSize: 13 }}>{item.detail}</Text>
            </View>
            {unread && <View style={[styles.dot, { backgroundColor: c.sys.primary }]} />}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.radiusFull, overflow: 'hidden' },
  segment: { flex: 1, minHeight: size.targetMobile, alignItems: 'center', justifyContent: 'center' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.space12,
    borderRadius: radius.radiusMd,
    padding: space.space16,
  },
  text: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
