import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { HELP_LIMITATIONS, HELP_STEPS, STATUS_MEANING, type IncidentStatus } from '@elderguard/shared';
import { useCurrentUser } from '../auth/authContext';
import { Screen } from '../components/Screen';
import { StatusChip } from '../components/StatusChip';
import { API_BASE_URL } from '../config';
import { radius, space, useColors } from '../theme';

/** M-31 Help & About: the same words as the web's Help page. */
export default function HelpScreen() {
  const c = useColors();
  const user = useCurrentUser();
  const version = Constants.expoConfig?.version ?? '';
  return (
    <Screen underHeader>
      <Section title="How alerts work">
        {HELP_STEPS.map((s, i) => (
          <View key={s.title} style={styles.step}>
            <Text style={{ color: c.sys.onSurface, fontWeight: '600' }}>
              {i + 1}. {s.title}
            </Text>
            <Text style={{ color: c.sys.onSurfaceVariant }}>{s.body}</Text>
          </View>
        ))}
      </Section>
      <Section title="What each status means">
        {(Object.keys(STATUS_MEANING) as IncidentStatus[]).map((s) => (
          <View key={s} style={styles.status}>
            <StatusChip status={s} />
            <Text style={{ color: c.sys.onSurface, flex: 1 }}>{STATUS_MEANING[s]}</Text>
          </View>
        ))}
      </Section>
      <Section title="Limitations">
        <Text style={{ color: c.sys.onSurface }}>{HELP_LIMITATIONS}</Text>
      </Section>
      <Section title="About">
        <Text style={{ color: c.sys.onSurface }}>
          ElderGuard {version} (mobile) · connected to {API_BASE_URL}
        </Text>
        {user.role !== 'admin' && (
          <Text style={{ color: c.sys.onSurfaceVariant }}>
            For your account, password or assigned rooms, ask your Admin/Head.
          </Text>
        )}
        <Text style={{ color: c.sys.onSurfaceVariant }}>
          Adding residents, cameras and staff, reports and settings are on the web app.
        </Text>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.section, { backgroundColor: c.sys.surfaceContainerLow }]}>
      <Text role="heading" style={[styles.title, { color: c.sys.onSurface }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: radius.radiusMd, padding: space.space16, gap: space.space12 },
  title: { fontSize: 17, fontWeight: '600' },
  step: { gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.space12 },
});
