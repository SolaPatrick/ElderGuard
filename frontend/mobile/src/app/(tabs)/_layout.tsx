import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useActiveIncidents } from '../../queries';
import { useColors } from '../../theme';

type IconName = keyof typeof MaterialIcons.glyphMap;

/** The tab bar passes the tint colors set below, which are plain strings. */
const tabIcon =
  (name: IconName) =>
  ({ color }: { color: unknown }) => (
    <MaterialIcons name={name} size={24} color={typeof color === 'string' ? color : undefined} />
  );

/** Bottom navigation. Cameras and SOS join as their screens are built. */
export default function TabsLayout() {
  const c = useColors();
  const active = useActiveIncidents().data?.length ?? 0;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.sys.onSurface,
        tabBarInactiveTintColor: c.sys.onSurfaceVariant,
        tabBarStyle: { backgroundColor: c.sys.surfaceContainer },
        headerStyle: { backgroundColor: c.sys.surface },
        headerTintColor: c.sys.onSurface,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: tabIcon('home'),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarBadge: active > 0 ? active : undefined,
          tabBarBadgeStyle: { backgroundColor: c.sys.critical, color: c.sys.onCritical },
          tabBarIcon: tabIcon('notifications-active'),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: tabIcon('menu'),
        }}
      />
    </Tabs>
  );
}
