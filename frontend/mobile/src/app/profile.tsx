import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { initials } from '@elderguard/shared';
import { serverFeatures } from '../api';
import { useCurrentUser } from '../auth/authContext';
import { Button } from '../components/Button';
import { Choice } from '../components/Choice';
import { Screen } from '../components/Screen';
import { startAlarm } from '../hooks/useAlarm';
import { setPref, usePrefs, type AlarmVolume, type Appearance, type Vibrate } from '../prefs';
import { radius, space, useColors } from '../theme';

const ROLE_LABEL = { admin: 'Admin/Head', employee: 'Employee' } as const;
const TEST_SECONDS = 3;

const APPEARANCE: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'Same as phone' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const VOLUME: { value: AlarmVolume; label: string }[] = [
  { value: 'max', label: 'Loudest' },
  { value: 'high', label: 'Loud' },
  { value: 'medium', label: 'Medium' },
];
const VIBRATE: { value: Vibrate; label: string }[] = [
  { value: 'on', label: 'Vibrate with the alarm' },
  { value: 'off', label: 'Sound only' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.sys.surfaceContainerLow }]}>
      <Text role="heading" style={[styles.heading, { color: c.sys.onSurface }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Fact({ label, children }: { label: string; children: string }) {
  const c = useColors();
  return (
    <View accessible accessibilityLabel={`${label}: ${children}`}>
      <Text style={[styles.factLabel, { color: c.sys.onSurfaceVariant }]}>{label}</Text>
      <Text style={{ color: c.sys.onSurface, fontSize: 16 }}>{children}</Text>
    </View>
  );
}

/** Plays the alarm for a few seconds with the chosen volume and vibration. */
function TestAlarm() {
  const [playing, setPlaying] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const play = () => {
    stop.current = startAlarm();
    setPlaying(true);
    setTimeout(() => {
      stop.current?.();
      stop.current = null;
      setPlaying(false);
    }, TEST_SECONDS * 1000);
  };

  return (
    <Button
      label={playing ? 'Playing the alarm…' : 'Test the alarm'}
      variant="outlined"
      onPress={play}
      disabled={playing}
    />
  );
}

/**
 * M-29 Profile & settings. The account is read-only: no server lets staff edit their own details.
 * The settings below it change this phone only.
 */
export default function ProfileScreen() {
  const user = useCurrentUser();
  const prefs = usePrefs();
  const c = useColors();
  const isAdmin = user.role === 'admin';
  const role =
    user.title && user.title !== ROLE_LABEL[user.role]
      ? `${ROLE_LABEL[user.role]} · ${user.title}`
      : ROLE_LABEL[user.role];
  const rooms = isAdmin
    ? 'All rooms and areas'
    : !serverFeatures.areaAssignment
      ? 'All rooms (rooms are not assigned to staff yet)'
      : user.areas.length === 0
        ? 'None assigned yet'
        : user.areas.map((a) => (a.wing ? `${a.name} · ${a.wing}` : a.name)).join(', ');

  return (
    <Screen underHeader>
      <Section title="My profile">
        <View style={styles.who}>
          <View style={[styles.avatar, { backgroundColor: c.sys.primaryContainer }]}>
            <Text style={[styles.initials, { color: c.sys.onPrimaryContainer }]}>
              {initials(user.fullName)}
            </Text>
          </View>
          <Text style={[styles.name, { color: c.sys.onSurface }]}>{user.fullName}</Text>
        </View>
        <Fact label="Username">{user.username}</Fact>
        <Fact label="Email">{user.email ?? 'None'}</Fact>
        <Fact label="Role">{role}</Fact>
        <Fact label="Rooms and areas">{rooms}</Fact>
        <Text style={{ color: c.sys.onSurfaceVariant }}>
          {isAdmin
            ? 'You can change your name and email in the web console, under Users & Access.'
            : 'Ask your Admin/Head to change your name, email, role or rooms.'}
        </Text>
        <Button label="Change password" variant="outlined" onPress={() => router.push('/change-password')} />
      </Section>

      <Section title="Alarm on this phone">
        <Choice
          label="Alarm volume"
          options={VOLUME}
          value={prefs.alarmVolume}
          onChange={(v) => setPref('alarmVolume', v)}
        />
        <Choice
          label="Vibration"
          options={VIBRATE}
          value={prefs.vibrate}
          onChange={(v) => setPref('vibrate', v)}
        />
        <TestAlarm />
        <Text style={{ color: c.sys.onSurfaceVariant }}>
          The alarm plays even when the ringer is on silent. These settings change this phone only.
        </Text>
      </Section>

      <Section title="Appearance">
        <Choice
          label="Light or dark"
          options={APPEARANCE}
          value={prefs.appearance}
          onChange={(v) => setPref('appearance', v)}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.radiusMd, padding: space.space16, gap: space.space12 },
  heading: { fontSize: 18, fontWeight: '600' },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.space12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 22, fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '600', flex: 1 },
  factLabel: { fontSize: 12 },
});
